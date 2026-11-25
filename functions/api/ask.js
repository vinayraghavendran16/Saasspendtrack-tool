import { recordUsage } from '../_shared/usage.js';
import { requireEntitledRole, rateLimit } from '../_shared/util.js';
// Cloudflare Pages Function - POST /api/ask
// Ask Track AI: answers a natural-language question using ONLY an app-computed
// snapshot of the workspace (every number is pre-calculated client-side, so the
// model selects/explains rather than doing raw arithmetic - keeps answers
// accurate). Requires ANTHROPIC_API_KEY. Shares the model-discovery approach
// with /api/extract.

const MODEL_DEFAULT = "claude-3-5-sonnet-20241022";
let _cachedModel = null;

async function listModels(env) {
  const r = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
  });
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  return (j.data || []).filter((m) => m && m.id);
}
async function resolveModel(env) {
  if (env.EXTRACT_MODEL) return env.EXTRACT_MODEL;
  if (_cachedModel) return _cachedModel;
  try {
    const models = await listModels(env);
    if (models.length) {
      const byNewest = (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""));
      const sonnets = models.filter((m) => /sonnet/i.test(m.id)).sort(byNewest);
      const pick = sonnets[0] || models.slice().sort(byNewest)[0];
      if (pick && pick.id) { _cachedModel = pick.id; return pick.id; }
    }
  } catch (_) {}
  return MODEL_DEFAULT;
}

const SYSTEM = `You are Ask Track, a SaaS spend and contract analyst. You answer questions about the user's own workspace using ONLY the JSON snapshot provided in the user message. Rules:
- Every figure in the snapshot is already computed (monthly cost, annual run-rate, totals, renewal dates). Use those numbers directly. You may add, subtract, compare, filter and sort them, but do NOT invent or re-derive figures that are not supported by the snapshot.
- If the snapshot does not contain what is needed to answer, say so plainly and suggest what the user could add (e.g. "no seat count is recorded for Slack").
- Be concise and specific. Lead with the answer. When money is involved, state the currency as given in the snapshot. Name the vendors and figures you used.
- Never mention the word "snapshot" or that you were given JSON; just answer as if you know their data.
- Do not give legal, tax or investment advice; stick to what the data shows.`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env }) {
  const headers = { ...CORS, "Content-Type": "application/json" };
  return new Response(JSON.stringify({ ok: true, configured: !!env.ANTHROPIC_API_KEY }), { status: 200, headers });
}

export async function onRequestPost({ request, env }) {
  const headers = { ...CORS, "Content-Type": "application/json" };
  try {
    const gate = await requireEntitledRole(request, env, 'member');
    if (gate.response) return gate.response;
    // Never transmit customer-supplied data to an AI provider without opt-in.
    let aiEnabled = false;
    try {
      const row = await env.DB.prepare(
        'SELECT enabled, consent_version FROM workspace_ai_settings WHERE account_id=?',
      ).bind(gate.membership.account_id).first();
      aiEnabled = row?.enabled === 1 && row?.consent_version === 'workspace-ai-v2';
    } catch (_) { /* fail closed */ }
    if (!aiEnabled) return new Response(JSON.stringify({ ok: false, error: 'ai_consent_required' }), { status: 403, headers });
    const _rl = await rateLimit(env, "ai:" + gate.user.email, 60, 3600000, { failClosed: true });
    if (!_rl.ok) return new Response(JSON.stringify({ ok: false, error: "rate_limited", message: "Too many AI requests. Try again shortly." }), { status: 429, headers });
    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "not_configured", message: "ANTHROPIC_API_KEY is not set on the server." }), { status: 501, headers });
    }
    const body = await request.json().catch(() => ({}));
    const question = (body.question || "").toString().trim();
    const snapshot = body.snapshot;
    if (!question) {
      return new Response(JSON.stringify({ ok: false, error: "no_question" }), { status: 400, headers });
    }
    if (!snapshot || typeof snapshot !== "object") {
      return new Response(JSON.stringify({ ok: false, error: "no_snapshot" }), { status: 400, headers });
    }
    const model = await resolveModel(env);
    const snapStr = JSON.stringify(snapshot).slice(0, 180000);
    const payload = {
      model,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Here is my current workspace data as JSON:\n\n${snapStr}\n\nQuestion: ${question}`,
        },
      ],
    };
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      return new Response(JSON.stringify({ ok: false, error: "upstream", message: "AI service unavailable. Try again later." }), { status: 200, headers });
    }
    const data = await r.json();
    const answer = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!answer) {
      return new Response(JSON.stringify({ ok: false, error: "no_answer" }), { status: 200, headers });
    }
    await recordUsage(env, {accountId:gate.membership.account_id,email:gate.user.email,eventName:'ai_completed'});
    return new Response(JSON.stringify({ ok: true, answer, model, usage: data.usage || null }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "exception", message: "AI request could not be completed." }), { status: 200, headers });
  }
}
