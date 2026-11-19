import { requireEntitled, rateLimit } from '../_shared/util.js';
// Cloudflare Pages Function — GET/POST /api/sheet-csv
// Fetches a shared Google Sheet as CSV server-side (no browser CORS limits) so
// the client can import the rows. Works for any sheet shared as "anyone with the
// link can view". Private sheets return a sign-in page, which we detect and
// report rather than importing garbage.

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }

function parseSheet(url) {
  const u = String(url || "");
  const id = (u.match(/\/spreadsheets\/d\/([a-zA-Z0-9\-_]+)/) || [])[1] || (/^[a-zA-Z0-9\-_]{20,}$/.test(u.trim()) ? u.trim() : "");
  const gid = (u.match(/[#&?]gid=(\d+)/) || [])[1] || "0";
  return { id, gid };
}

async function handle(url) {
  const headers = { ...CORS, "Content-Type": "application/json" };
  const { id, gid } = parseSheet(url);
  if (!id) return new Response(JSON.stringify({ ok: false, error: "bad_url", message: "That doesn't look like a Google Sheets link." }), { status: 400, headers });
  const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  try {
    const r = await fetch(exportUrl, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 SaaSSpendTrack" } });
    const ct = r.headers.get("content-type") || "";
    const body = await r.text();
    // A private sheet redirects to an HTML sign-in page instead of CSV.
    if (!r.ok || ct.includes("text/html") || body.slice(0, 200).toLowerCase().includes("<!doctype html")) {
      return new Response(JSON.stringify({ ok: false, error: "not_public", message: "Couldn't read the sheet. Set its sharing to 'Anyone with the link can view', then try again." }), { status: 200, headers });
    }
    if (!body.trim()) return new Response(JSON.stringify({ ok: false, error: "empty", message: "The sheet (or that tab) is empty." }), { status: 200, headers });
    return new Response(JSON.stringify({ ok: true, csv: body, id, gid }), { status: 200, headers });
  } catch (e) {
    console.error("sheet-csv fetch failed", String((e && e.message) || e));
    return new Response(JSON.stringify({ ok: false, error: "fetch_failed", message: "Couldn't fetch the sheet." }), { status: 200, headers });
  }
}

async function guard(request, env) {
  const gate = await requireEntitled(request, env);
  if (gate.response) return gate.response;
  const rl = await rateLimit(env, "sheet:" + gate.user.email, 60, 3600000);
  if (!rl.ok) return new Response(JSON.stringify({ ok: false, error: "rate_limited", message: "Too many requests. Try again shortly." }), { status: 429, headers: { ...CORS, "Content-Type": "application/json" } });
  return null;
}
export async function onRequestGet({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const u = new URL(request.url).searchParams.get("url") || "";
  return handle(u);
}
export async function onRequestPost({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const body = await request.json().catch(() => ({}));
  return handle(body.url || "");
}
