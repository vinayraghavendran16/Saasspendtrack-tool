import { requireEntitledRole, rateLimit, upstreamMessage } from '../_shared/util.js';
// Cloudflare Pages Function - POST /api/renewal-guide
// Produces a vendor renewal/cancellation guide grounded in LIVE web search, so
// it reflects terms valid at request time and never relies on model memory.
// Claude is required to cite sources and to mark anything it cannot verify
// rather than guessing. Requires ANTHROPIC_API_KEY.

const MODEL_DEFAULT = "claude-3-5-sonnet-20241022";
let _cachedModel = null;
async function listModels(env) {
  const r = await fetch("https://api.anthropic.com/v1/models?limit=100", { headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" } });
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

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }
export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ ok: true, configured: !!env.ANTHROPIC_API_KEY }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
}

export async function onRequestPost({ request, env }) {
  const headers = { ...CORS, "Content-Type": "application/json" };
  try {
    const gate = await requireEntitledRole(request, env, 'member');
    if (gate.response) return gate.response;
    const _rl = await rateLimit(env, "ai:" + gate.user.email, 60, 3600000);
    if (!_rl.ok) return new Response(JSON.stringify({ ok: false, error: "rate_limited", message: "Too many AI requests. Try again shortly." }), { status: 429, headers });
    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "not_configured", message: "ANTHROPIC_API_KEY is not set on the server." }), { status: 501, headers });
    }
    const body = await request.json().catch(() => ({}));
    const vendor = (body.vendor || "").toString().trim().slice(0, 80);
    if (!vendor) return new Response(JSON.stringify({ ok: false, error: "no_vendor" }), { status: 400, headers });
    const officialUrl = (body.officialUrl || "").toString().slice(0, 300);
    const today = new Date().toISOString().slice(0, 10);
    const model = await resolveModel(env);

    const system = `You write accurate, source-grounded SaaS renewal and cancellation guides for a procurement tool. Today is ${today}.
STRICT RULES - accuracy over completeness:
- Use the web_search tool to find the vendor's CURRENT, official terms (master subscription agreement, order-form boilerplate, auto-renewal and cancellation policy) and reputable, recent third-party guidance. Prefer the vendor's own domain.
- Base every factual statement on a source you actually retrieved in this session. Do NOT use prior knowledge for specifics like notice-period length, auto-renewal behaviour, cancellation method, or where to send notice.
- If you cannot find and verify a specific detail, say "Not verified - confirm in your signed contract or with the vendor." NEVER guess a number, duration, date, email, or URL.
- Note that terms vary by contract date, region and negotiated order form, and that the customer's signed order form overrides the public defaults.
- Keep it practical and concise: what the default renewal behaviour appears to be, the notice window if stated, the concrete steps to cancel or give notice, and the key caveats. Add inline source references.
- End with a one-line reminder to check their own signed order form/MSA.`;

    const payload = {
      model,
      max_tokens: 1500,
      system,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      messages: [{
        role: "user",
        content: `Write a renewal and cancellation guide for ${vendor}.${officialUrl ? ` Their official terms page is ${officialUrl} - check it first.` : ""} Search for current sources, cite them, and mark anything you can't verify.`,
      }],
    };

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error("[renewal-guide] upstream error", r.status, errText.slice(0, 500));
      return new Response(JSON.stringify({ ok: false, error: "upstream", message: upstreamMessage(r.status) }), { status: 200, headers });
    }
    const data = await r.json();
    const blocks = data.content || [];
    const guide = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    // Collect sources from web_search results and from text citations.
    const sources = [];
    const seen = new Set();
    const addSrc = (url, title) => { if (url && !seen.has(url)) { seen.add(url); sources.push({ url, title: title || url }); } };
    blocks.forEach((b) => {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        b.content.forEach((it) => { if (it && it.url) addSrc(it.url, it.title); });
      }
      if (b.type === "text" && Array.isArray(b.citations)) {
        b.citations.forEach((c) => { if (c && c.url) addSrc(c.url, c.title); });
      }
    });
    if (!guide) return new Response(JSON.stringify({ ok: false, error: "no_guide", message: "Could not produce a verified guide." }), { status: 200, headers });
    return new Response(JSON.stringify({ ok: true, vendor, guide, sources, checkedAt: new Date().toISOString(), model }), { status: 200, headers });
  } catch (e) {
    console.error("[renewal-guide] exception", String((e && e.stack) || (e && e.message) || e));
    return new Response(JSON.stringify({ ok: false, error: "exception", message: "Something went wrong building that guide. Please try again." }), { status: 200, headers });
  }
}
