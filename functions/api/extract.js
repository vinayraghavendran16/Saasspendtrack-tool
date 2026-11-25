import { hasAiConsent, aiFetch } from '../_shared/ai-gateway.js';
import { recordUsage } from '../_shared/usage.js';
import { requireEntitledRole, rateLimit } from '../_shared/util.js';
// Cloudflare Pages Function - POST /api/extract
// World-class contract extraction: sends contract text to the Anthropic API
// and returns structured, schema-validated facts via tool use.
//
// Setup (one time):
//   Cloudflare dashboard → your Pages project → Settings → Environment variables
//     ANTHROPIC_API_KEY = sk-ant-...        (required, mark as "Secret/Encrypt")
//     EXTRACT_MODEL      = claude-3-5-sonnet-20241022   (optional override)
//   Redeploy. The client calls this same-origin, so there are no CORS issues
//   and the key never reaches the browser.

// Last-resort fallback only. Normally the model is auto-discovered from the
// account (resolveModel) or set via EXTRACT_MODEL.
const MODEL_DEFAULT = "claude-3-5-sonnet-20241022";

// Cached across requests within a warm isolate to avoid a models lookup per call.
let _cachedModel = null;

async function listModels(env, accountId) {
  const r = await aiFetch(env, accountId, "https://api.anthropic.com/v1/models?limit=100", {
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
  });
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  return (j.data || []).filter((m) => m && m.id);
}

// Pick the best available model: an explicit EXTRACT_MODEL override wins;
// otherwise prefer the newest Sonnet the account can use, then any newest model.
async function resolveModel(env, accountId) {
  if (env.EXTRACT_MODEL) return env.EXTRACT_MODEL;
  if (_cachedModel) return _cachedModel;
  try {
    const models = await listModels(env, accountId);
    if (models.length) {
      const byNewest = (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""));
      const sonnets = models.filter((m) => /sonnet/i.test(m.id)).sort(byNewest);
      const pick = (sonnets[0] || models.slice().sort(byNewest)[0]);
      if (pick && pick.id) { _cachedModel = pick.id; return pick.id; }
    }
  } catch (_) { /* fall through */ }
  return MODEL_DEFAULT;
}

const EXTRACT_TOOL = {
  name: "record_contract",
  description:
    "Record the structured facts extracted from a SaaS/vendor contract, order form, quote, or MSA.",
  input_schema: {
    type: "object",
    properties: {
      vendor_name: {
        type: "string",
        description:
          "Short common name of the VENDOR/supplier - the party providing the software or service (often defined as 'us'/'we'/'our' or shown in the header/logo), e.g. 'Outreach'. NEVER the customer.",
      },
      vendor_legal_name: { type: "string" },
      customer_name: { type: "string" },
      order_type: {
        type: "string",
        enum: ["new", "renewal", "amendment", "expansion", "unknown"],
      },
      currency: { type: "string", description: "ISO code, e.g. USD, INR, EUR, GBP." },
      total_contract_value: {
        type: "number",
        description: "Total value for the WHOLE term, numeric only (no symbols or commas).",
      },
      annual_value: {
        type: "number",
        description: "Annualised value (total ÷ term years) when the term can be determined.",
      },
      billing_frequency: {
        type: "string",
        enum: ["monthly", "quarterly", "semi-annual", "annual", "one-time", "usage-based", "unknown"],
      },
      payment_terms_days: { type: "integer", description: "Net payment days (e.g. 30 for 'Net 30')." },
      term_start_date: { type: "string", description: "ISO date YYYY-MM-DD." },
      term_end_date: { type: "string", description: "ISO date YYYY-MM-DD - the renewal/expiry date." },
      term_months: { type: "integer" },
      auto_renews: { type: "boolean" },
      renewal_notice_days: { type: "integer", description: "Notice days required to cancel / not renew." },
      renewal_terms: { type: "string" },
      price_increase_cap_pct: { type: "number", description: "Max % uplift at renewal, if capped." },
      seats: { type: "integer", description: "Total licensed seats / primary quantity." },
      category: { type: "string", description: "Software category, e.g. 'Sales engagement', 'Observability'." },
      governing_law: { type: "string" },
      liability_cap: { type: "string" },
      indemnity: { type: "string" },
      dpa: { type: "string", description: "Data-processing / DPA terms, or omit." },
      security_certifications: { type: "string", description: "e.g. 'SOC 2 Type II, ISO 27001'." },
      sla_uptime_pct: { type: "number" },
      support_tier: { type: "string" },
      termination_rights: { type: "string" },
      warranty: { type: "string" },
      assignment: { type: "string" },
      audit_rights: { type: "string" },
      late_fee: { type: "string" },
      non_cancelable: { type: "boolean" },
      line_items: {
        type: "array",
        description: "Each priced line on the order form.",
        items: {
          type: "object",
          properties: {
            service: { type: "string" },
            quantity: { type: "number" },
            unit_price: { type: "number" },
            total: { type: "number" },
          },
          required: ["service"],
        },
      },
      summary: {
        type: "string",
        description: "One or two plain-English sentences summarising the deal.",
      },
      confidence: {
        type: "integer",
        description: "0-100 honest overall confidence in this extraction.",
      },
    },
    required: ["vendor_name", "confidence"],
  },
};

// Treat model output as untrusted, including text-JSON fallback results.
function validContract(value, schema = EXTRACT_TOOL.input_schema) {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if ((schema.required || []).some(key => !Object.hasOwn(value, key))) return false;
    return Object.entries(value).every(([key, item]) =>
      Object.hasOwn(schema.properties, key) && validContract(item, schema.properties[key]));
  }
  if (schema.type === 'array') return Array.isArray(value) && value.every(item => validContract(item, schema.items));
  if (schema.type === 'number' || schema.type === 'integer') {
    return typeof value === 'number' && Number.isFinite(value) &&
      (schema.type !== 'integer' || Number.isInteger(value));
  }
  return typeof value === schema.type && (!schema.enum || schema.enum.includes(value));
}

const SYSTEM = `You are a meticulous commercial-contracts analyst. Extract the requested fields from the provided SaaS/vendor contract, order form, quote or MSA. Rules:
- The VENDOR is the party supplying the software/service (often defined as "us"/"we"/"our", or shown in the header/logo). The CUSTOMER is the buyer ("you"/"your"). Never confuse them; vendor_name is the supplier.
- Report money as plain numbers, no symbols or commas. If a grand "Total" is shown, that is total_contract_value. Compute annual_value from the term when possible (e.g. a $600,000 total over 24 months → annual_value 300000).
- Dates must be ISO YYYY-MM-DD. The renewal/expiry date is the services/term end date.
- "Net 30" → payment_terms_days 30. "shall not automatically renew" → auto_renews false. "automatically renew" / "evergreen" → auto_renews true.
- Prefer facts stated in THIS document; if it defers to a master agreement you were not given, omit those fields rather than inventing them.
- Only include fields you can support from the text. Omit what you cannot determine. Set confidence honestly based on how much of the document you could ground.
- Call the record_contract tool exactly once with your result.`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// GET /api/extract            → health: is the key visible, which model.
// GET /api/extract?test=1     → also runs a minimal Anthropic call and reports
//                               the upstream status + a short body snippet, so
//                               we can see exactly why the main path fails.
// Minimal, safe health check - no secrets, no model list, no billable calls.
export async function onRequestGet({ env }) {
  const headers = { ...CORS, "Content-Type": "application/json" };
  return new Response(JSON.stringify({ ok: true, configured: !!env.ANTHROPIC_API_KEY }), { status: 200, headers });
}

export async function onRequestPost({ request, env }) {
  const headers = { ...CORS, "Content-Type": "application/json" };
  try {
    const gate = await requireEntitledRole(request, env, 'member');
    if (gate.response) return gate.response;
    // Workspace consent is required before document contents reach an AI provider.
    // Missing tables/settings are intentionally denied, never treated as opt-in.
    const aiEnabled = await hasAiConsent(env, gate.membership.account_id);
    if (!aiEnabled) return new Response(
      JSON.stringify({ ok: false, error: 'ai_consent_required' }),
      { status: 403, headers },
    );
    const _rl = await rateLimit(env, "ai:" + gate.user.email, 60, 3600000, { failClosed: true });
    if (!_rl.ok) return new Response(JSON.stringify({ ok: false, error: "rate_limited", message: "Too many AI requests. Try again shortly." }), { status: 429, headers });
    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "not_configured", message: "ANTHROPIC_API_KEY is not set on the server." }),
        { status: 501, headers }
      );
    }
    const body = await request.json().catch(() => ({}));
    const text = (body.text || "").toString();
    const pdfBase64 = (body.pdf_base64 || "").toString();
    const mediaType = (body.media_type || "application/pdf").toString();
    const hasPdf = pdfBase64.length > 100;
    if (!hasPdf && (!text.trim() || text.length < 40)) {
      return new Response(JSON.stringify({ ok: false, error: "no_input" }), { status: 400, headers });
    }
    const model = await resolveModel(env, gate.membership.account_id);
    // Prefer the native PDF document block (Claude reads tables and scanned
    // pages directly) when the raw PDF is supplied; otherwise send the text.
    const userContent = hasPdf
      ? [
          { type: "document", source: { type: "base64", media_type: mediaType, data: pdfBase64 } },
          { type: "text", text: "Extract the contract facts from the attached document and call record_contract." },
        ]
      : `Extract the contract facts from the following document:\n\n<contract>\n${text.slice(0, 120000)}\n</contract>`;
    const payload = {
      model,
      max_tokens: 2000,
      system: SYSTEM,
      tools: [EXTRACT_TOOL],
      // Newer models reject forced tool_choice ("tool"/"any"); "auto" works and
      // the system prompt instructs the model to call record_contract once.
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: userContent }],
    };
    const r = await aiFetch(env, gate.membership.account_id, "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      // Do not reflect provider response bodies, which may include input or credentials.
      // Use HTTP 200 with ok:false: Cloudflare replaces real 5xx responses with
      // its own HTML error page, which the client can't parse. The client keys
      // off the JSON body's ok flag, not the HTTP status.
      return new Response(
        JSON.stringify({ ok: false, error: "upstream", upstream_status: r.status, message: "The AI provider could not complete the request. Please retry later." }),
        { status: 200, headers }
      );
    }
    const data = await r.json();
    const blocks = Array.isArray(data.content) ? data.content : [];
    const toolUse = blocks.find((b) => b.type === "tool_use" && b.name === "record_contract");
    let result = toolUse && toolUse.input;
    // Fallback: if the model answered with text instead of a tool call, pull the
    // first JSON object out of the text.
    if (!result) {
      const textOut = blocks.filter((b) => b.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
      const m = textOut.match(/\{[\s\S]*\}/);
      if (m) { try { result = JSON.parse(m[0]); } catch (_) {} }
    }
    if (!result) {
      return new Response(JSON.stringify({ ok: false, error: "no_result", message: "The model did not return structured data." }), { status: 200, headers });
    }
    if (!validContract(result) || !result.vendor_name.trim() || result.confidence < 0 || result.confidence > 100) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_result", message: "The provider returned invalid contract data. Please retry." }), { status: 200, headers });
    }
    await recordUsage(env, {accountId:gate.membership.account_id,email:gate.user.email,eventName:'extraction_completed'});
    return new Response(
      JSON.stringify({ ok: true, data: result, model, usage: data.usage || null }),
      { status: 200, headers }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: "exception", message: "Contract extraction could not complete. Please retry later." }),
      { status: 200, headers }
    );
  }
}
