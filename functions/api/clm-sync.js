// Cloudflare Pages Function - POST /api/clm-sync
// A generic, authenticated REST proxy for pulling contracts out of a CLM's API.
// It does not hard-code any vendor's schema: the caller gives the base URL, the
// endpoint path, the auth token/scheme, and (optionally) the JSON path to the
// records array. The function fetches server-side (no browser CORS), finds the
// array of records, flattens each to shallow key/value pairs, and returns rows
// the client turns into CSV and imports through the reviewed importer.

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }

function getPath(obj, path) {
  if (!path) return undefined;
  return String(path).split(".").reduce((o, k) => (o == null ? undefined : o[k.trim()]), obj);
}
function firstArray(obj, depth = 0) {
  if (Array.isArray(obj)) return obj;
  if (!obj || typeof obj !== "object" || depth > 4) return null;
  for (const k of ["data", "records", "results", "items", "workflows", "contracts", "value", "rows"]) {
    if (Array.isArray(obj[k])) return obj[k];
  }
  for (const k of Object.keys(obj)) { const got = firstArray(obj[k], depth + 1); if (got) return got; }
  return null;
}
function flatten(rec, prefix = "", out = {}, depth = 0) {
  if (rec == null || typeof rec !== "object" || depth > 3) { if (prefix) out[prefix] = rec; return out; }
  if (Array.isArray(rec)) { out[prefix] = rec.map((v) => (v && typeof v === "object" ? JSON.stringify(v) : v)).join("; "); return out; }
  for (const [k, v] of Object.entries(rec)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out, depth + 1);
    else if (Array.isArray(v)) out[key] = v.map((x) => (x && typeof x === "object" ? (x.name || x.title || JSON.stringify(x)) : x)).join("; ");
    else out[key] = v;
  }
  return out;
}

import { requireEntitled, rateLimit, isPublicHttpsHost } from '../_shared/util.js';

export async function onRequestPost({ request, env }) {
  const headers = { ...CORS, "Content-Type": "application/json" };
  try {
    const gate = await requireEntitled(request, env);
    if (gate.response) return gate.response;
    const rl = await rateLimit(env, "clm:" + gate.user.email, 30, 3600000);
    if (!rl.ok) return new Response(JSON.stringify({ ok: false, error: "rate_limited", message: "Too many sync requests. Try again shortly." }), { status: 429, headers });
    const b = await request.json().catch(() => ({}));
    const baseUrl = String(b.baseUrl || "").trim().replace(/\/+$/, "");
    const path = String(b.path || "").trim();
    const token = String(b.token || "").trim();
    const scheme = (b.scheme || "bearer").toString();
    const headerName = (b.headerName || "Authorization").toString();
    const recordsPath = (b.recordsPath || "").toString();
    if (!baseUrl || !/^https:\/\//i.test(baseUrl)) return new Response(JSON.stringify({ ok: false, error: "bad_base", message: "Enter the API base URL (https://...)." }), { status: 400, headers });
    if (!isPublicHttpsHost(baseUrl)) return new Response(JSON.stringify({ ok: false, error: "bad_host", message: "That host is not allowed." }), { status: 400, headers });
    if (!token) return new Response(JSON.stringify({ ok: false, error: "no_token", message: "Enter your API token." }), { status: 400, headers });
    const url = baseUrl + (path.startsWith("/") ? path : "/" + path);
    const reqHeaders = { accept: "application/json" };
    if (scheme === "bearer") reqHeaders[headerName] = `Bearer ${token}`;
    else if (scheme === "basic") reqHeaders[headerName] = `Basic ${btoa(token)}`;
    else reqHeaders[headerName] = token; // raw api-key header
    const r = await fetch(url, { headers: reqHeaders, redirect: "follow" });
    const text = await r.text();
    if (!r.ok) return new Response(JSON.stringify({ ok: false, error: "upstream", status: r.status, message: `CLM API returned ${r.status}. Check the token, base URL and endpoint.`, sample: text.slice(0, 200) }), { status: 200, headers });
    let json; try { json = JSON.parse(text); } catch (_) { return new Response(JSON.stringify({ ok: false, error: "not_json", message: "The endpoint didn't return JSON. Check the path." }), { status: 200, headers }); }
    const arr = recordsPath ? getPath(json, recordsPath) : firstArray(json);
    if (!Array.isArray(arr) || !arr.length) return new Response(JSON.stringify({ ok: false, error: "no_records", message: "No array of records found. Set the records path (e.g. data.records)." }), { status: 200, headers });
    const rows = arr.slice(0, 1000).map((rec) => flatten(rec));
    const keys = [];
    rows.slice(0, 50).forEach((row) => Object.keys(row).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
    return new Response(JSON.stringify({ ok: true, count: rows.length, keys: keys.slice(0, 60), rows }), { status: 200, headers });
  } catch (e) {
    console.error("clm-sync exception", String((e && e.message) || e));
    return new Response(JSON.stringify({ ok: false, error: "exception", message: "Something went wrong. Check the URL, token and path." }), { status: 200, headers });
  }
}
