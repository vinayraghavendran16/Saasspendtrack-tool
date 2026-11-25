import { hasAiConsent, aiFetch } from '../../_shared/ai-gateway.js';
import { requireEntitledRole, rateLimit, isPublicHttpsHost } from '../../_shared/util.js';
// Cloudflare Pages Function — POST /api/preset/generate
// Generates a demo workspace preset (a plausible SaaS stack) for a company,
// grounded in LIVE web search of that company's public website. Returns a
// preset object in the same shape the client's DEMO_PRESETS uses, so the app
// can load it straight into the browser. The model's output is treated as
// DATA: it is parsed as JSON and sanitised server-side before returning, never
// executed. Requires ANTHROPIC_API_KEY.

const MODEL_DEFAULT = "claude-3-5-sonnet-20241022";
let _cachedModel = null;
async function listModels(env, accountId) {
  const r = await aiFetch(env, accountId, "https://api.anthropic.com/v1/models?limit=100", { headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" } });
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  return (j.data || []).filter((m) => m && m.id);
}
async function resolveModel(env, accountId) {
  if (env.EXTRACT_MODEL) return env.EXTRACT_MODEL;
  if (_cachedModel) return _cachedModel;
  try {
    const models = await listModels(env, accountId);
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

const CATS = ["Infrastructure","Database","Analytics","Engineering","Development","Design","AI / LLM","Communication","Productivity","Security","Marketing","Sales","Sales Intelligence","CRM","Finance","Payments","HR","Legal","Observability","ERP","Supply Chain","Procurement","Support","Advertising","IT Service Management","Risk & Compliance"];

// Coerce the model's JSON into a safe preset. Everything is clamped and typed;
// nothing from the model is trusted as-is.
function sanitizePreset(raw, fallbackCompany) {
  const str = (v, n) => (v == null ? "" : String(v)).slice(0, n);
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
  const clampInt = (v, lo, hi, dflt) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : dflt; };
  const out = {
    generated: true,
    label: str(raw.label, 60) || "Generated workspace",
    description: str(raw.description, 240) || "Auto-generated from the company website.",
    company: str(raw.company, 80) || fallbackCompany,
    currencyPrefix: ["₹", "$", "€", "£"].includes(raw.currencyPrefix) ? raw.currencyPrefix : "$",
    employees: clampInt(raw.employees, 1, 500000, 100),
  };
  const deps = Array.isArray(raw.departments) ? raw.departments.map((d) => str(d, 40)).filter(Boolean).slice(0, 14) : [];
  out.departments = deps.length ? deps : ["Engineering", "Sales", "Marketing", "Finance", "Ops", "IT", "People"];
  const vraw = Array.isArray(raw.vendors) ? raw.vendors.slice(0, 30) : [];
  const vendors = [];
  for (const v of vraw) {
    if (!Array.isArray(v) || v.length < 3) continue;
    const name = str(v[0], 60);
    if (!name) continue;
    const cost = num(v[1]);
    let cat = str(v[2], 40);
    if (!CATS.includes(cat)) cat = "Productivity";
    const team = str(v[3], 40) || out.departments[0];
    const lic = v[4] == null ? null : clampInt(v[4], 0, 1000000, null);
    const act = v[5] == null ? null : clampInt(v[5], 0, 1000000, null);
    const ren = clampInt(v[6], 5, 400, 90);
    vendors.push([name, cost == null ? 0 : Math.max(0, Math.round(cost)), cat, team, lic, act, ren]);
  }
  out.vendors = vendors;
  return out;
}

function extractJson(text) {
  if (!text) return null;
  // Prefer a fenced block, else the first balanced object.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { try { return JSON.parse(candidate.slice(start, i + 1)); } catch (_) { return null; } } }
  }
  return null;
}

export async function onRequestPost({ request, env }) {
  const headers = { ...CORS, "Content-Type": "application/json" };
  try {
    const gate = await requireEntitledRole(request, env, 'member');
    if (gate.response) return gate.response;
    // Never transmit customer-supplied data to an AI provider without opt-in.
    const aiEnabled = await hasAiConsent(env, gate.membership.account_id);
    if (!aiEnabled) return new Response(JSON.stringify({ ok: false, error: 'ai_consent_required' }), { status: 403, headers });
    const _rl = await rateLimit(env, "ai:" + gate.user.email, 60, 3600000, { failClosed: true });
    if (!_rl.ok) return new Response(JSON.stringify({ ok: false, error: "rate_limited", message: "Too many AI requests. Try again shortly." }), { status: 429, headers });
    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "not_configured", message: "ANTHROPIC_API_KEY is not set on the server." }), { status: 501, headers });
    }

    const body = await request.json().catch(() => ({}));
    let url = (body.url || "").toString().trim().slice(0, 300);
    if (!url) return new Response(JSON.stringify({ ok: false, error: "no_url", message: "Enter a company website." }), { status: 400, headers });
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    url = url.replace(/^http:\/\//i, "https://");
    if (!isPublicHttpsHost(url)) {
      return new Response(JSON.stringify({ ok: false, error: "bad_url", message: "That does not look like a public company website." }), { status: 400, headers });
    }
    let domain = "";
    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch (_) {}
    const region = (body.region || "").toString().slice(0, 40); // optional hint, e.g. "India"
    const today = new Date().toISOString().slice(0, 10);
    const model = await resolveModel(env, gate.membership.account_id);

    const system = `You build realistic DEMO workspaces for a SaaS spend-management tool. Today is ${today}.
A sales rep will load this workspace to show a prospect what the product looks like with their own kind of data. It does NOT need to be their real stack - it needs to be a believable one for a company like theirs.

Use the web_search tool to learn about the company at the given website: what they do, their industry, rough size (employees), region, and the kinds of software a company like that typically runs. Prefer the company's own domain.

Return ONLY a single JSON object (no prose, no markdown fence) with EXACTLY this shape:
{
  "label": "short name for the preset, e.g. 'Acme (SaaS · 120 ppl)'",
  "description": "one sentence on the company and stack flavour",
  "company": "Company Name (Industry · City)",
  "currencyPrefix": one of "₹" "$" "€" "£" (use ₹ for India, $ default),
  "employees": integer estimate,
  "departments": ["Engineering","Sales", ... up to ~10],
  "vendors": [ [name, monthlyCost, category, team, licenses, activeUsers, renewalDays], ... 14 to 20 items ]
}
Vendor tuple rules:
- monthlyCost: a number in the chosen currency's base unit (for ₹ use rupees per month, realistic for company size; for $ use dollars per month). No symbols, no strings.
- category: pick from this list only: ${CATS.join(", ")}.
- team: one of the departments you listed.
- licenses and activeUsers: integers, or null for usage-based tools. Make activeUsers <= licenses, and make a few vendors clearly under-utilised.
- renewalDays: integer 10-360, days until renewal. Spread them out; put 1-2 within 30 days so the renewal dashboard looks alive.
Make the mix fit the industry (e.g. manufacturing -> ERP/CAD/MES; D2C -> ads/martech/logistics; BFSI -> security/compliance/market-data). Use real, well-known vendor names. Output JSON only.`;

    const payload = {
      model,
      max_tokens: 2600,
      system,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages: [{
        role: "user",
        content: `Build a demo workspace preset for the company at ${url}${domain ? ` (domain ${domain})` : ""}${region ? `, region hint: ${region}` : ""}. Research the site, then output the JSON object only.`,
      }],
    };

    const r = await aiFetch(env, gate.membership.account_id, "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      let apiMessage = ""; try { apiMessage = JSON.parse(errText)?.error?.message || ""; } catch (_) {}
      console.error("preset/generate upstream", r.status, errText.slice(0, 300));
      return new Response(JSON.stringify({ ok: false, error: "upstream", message: apiMessage || "AI request failed." }), { status: 200, headers });
    }
    const data = await r.json();
    const blocks = data.content || [];
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    const parsed = extractJson(text);
    if (!parsed) {
      return new Response(JSON.stringify({ ok: false, error: "no_preset", message: "Could not build a preset for that site. Try a different URL." }), { status: 200, headers });
    }
    const preset = sanitizePreset(parsed, domain || "Prospect");
    if (!preset.vendors.length) {
      return new Response(JSON.stringify({ ok: false, error: "empty", message: "The generated workspace had no vendors. Try again." }), { status: 200, headers });
    }
    return new Response(JSON.stringify({ ok: true, preset, source: domain, generatedAt: new Date().toISOString(), model }), { status: 200, headers });
  } catch (e) {
    console.error("preset/generate exception", (e && e.message) || e);
    return new Response(JSON.stringify({ ok: false, error: "exception", message: "Something went wrong generating the preset." }), { status: 200, headers });
  }
}
