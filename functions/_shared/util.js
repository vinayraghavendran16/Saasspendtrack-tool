// Shared helpers for SaaS Spend Track Pages Functions.

export const DAY = 86400000;
export const TRIAL_DAYS = 7;
export const SESSION_DAYS = 30;
export const TOKEN_MINUTES = 15;

export const now = () => Date.now();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function badRequest(msg) { return json({ error: msg }, 400); }
export function unauthorized(msg = 'unauthorized') { return json({ error: msg }, 401); }

// --- crypto helpers (Web Crypto, available in the Workers runtime) ---

export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input) {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// HMAC-SHA256 hex (used to verify the Razorpay webhook signature)
export async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// constant-time-ish compare
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// --- cookies ---

export function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const out = {};
  header.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export function sessionCookie(id, maxAgeSeconds = SESSION_DAYS * 86400) {
  return `sst_session=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}
export const clearSessionCookie = () =>
  'sst_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

// --- validation ---

export function normalizeEmail(raw) {
  const e = String(raw || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

// --- entitlement ---

// Returns the user's entitlement view, lazily expiring a lapsed trial.
export async function resolveEntitlement(env, user) {
  if (!user) return null;
  const t = now();
  let status = user.status;
  if (status === 'trial' && t >= user.trial_ends_at) {
    status = 'expired';
    await env.DB.prepare('UPDATE users SET status=? WHERE email=?').bind('expired', user.email).run();
  }
  const entitled = status === 'active' || (status === 'trial' && t < user.trial_ends_at);
  const daysLeft = Math.max(0, Math.ceil((user.trial_ends_at - t) / DAY));
  return {
    email: user.email,
    status,
    plan: user.plan || null,
    trialEndsAt: user.trial_ends_at,
    daysLeft,
    entitled,
  };
}

// True if the email is listed in ADMIN_EMAILS (comma-separated).
export function isAdmin(env, email) {
  if (!email) return false;
  const list = String(env.ADMIN_EMAILS || '')
    .toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);

  return list.includes(email.toLowerCase());
}

// Fixed-window rate limiter backed by D1. Fails OPEN on any error so a limiter
// problem never blocks real users.
export async function rateLimit(env, key, limit, windowMs) {
  const t = now();
  const threshold = t - windowMs;
  try {
    const row = await env.DB.prepare(
      `INSERT INTO rate_limits (rl_key, count, window_start) VALUES (?1, 1, ?2)
       ON CONFLICT(rl_key) DO UPDATE SET
         count = CASE WHEN window_start < ?3 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN window_start < ?3 THEN ?2 ELSE window_start END
       RETURNING count`,
    ).bind(key, t, threshold).first();
    const count = row ? row.count : 1;
    return { ok: count <= limit, count, limit };
  } catch (_) {
    return { ok: true, count: 0, limit };
  }
}

export function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim()
    || 'unknown';
}

// Best-effort SSRF guard: reject internal / loopback / link-local hosts.
export function isPublicHttpsHost(urlStr) {
  let u;
  try { u = new URL(urlStr); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  if (h.includes(':')) return false;            // raw IPv6 literal
  if (!h.includes('.')) return false;           // bare hostname
  if (h === 'localhost' || h.endsWith('.localhost') ||
      h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {    // literal IPv4
    const o = h.split('.').map(Number);
    if (o[0] === 10 || o[0] === 127 || o[0] === 0) return false;
    if (o[0] === 169 && o[1] === 254) return false;            // link-local/metadata
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return false;
    if (o[0] === 192 && o[1] === 168) return false;
    if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return false; // CGNAT
  }
  return true;
}

// Reusable guards for feature endpoints.
//
//   export async function onRequestPost(ctx) {
//     const gate = await requireEntitled(ctx.request, ctx.env);
//     if (gate.response) return gate.response;   // 401 / 403, short-circuit
//     const { user, ent } = gate;                // entitled user, proceed
//     ...
//   }
//
// Use requireEntitled for any paid/trial feature (AI extraction, exports,
// analysis). Use requireAdmin for owner-only endpoints.
export async function requireEntitled(request, env) {
  const user = await getUserFromSession(request, env);
  if (!user) return { response: unauthorized('sign in required') };
  const ent = await resolveEntitlement(env, user);
  if (!ent.entitled) return { response: json({ error: 'not_entitled' }, 403) };
  return { user, ent };
}

export async function requireAdmin(request, env) {
  const user = await getUserFromSession(request, env);
  if (!user) return { response: unauthorized('sign in required') };
  if (!isAdmin(env, user.email)) return { response: unauthorized('not an admin') };
  return { user };
}

// Reads the session cookie and returns the user row, or null.
export async function getUserFromSession(request, env) {
  const sid = parseCookies(request).sst_session;
  if (!sid) return null;
  const session = await env.DB
    .prepare('SELECT * FROM sessions WHERE id=? AND expires_at > ?')
    .bind(sid, now()).first();
  if (!session) return null;
  return env.DB.prepare('SELECT * FROM users WHERE email=?').bind(session.email).first();
}

// ===================================================================
// Multi-user accounts (Phase 1: helpers ship dark - defined and tested,
// but not yet called by any live endpoint). Roles: owner > admin > member.
// One account per member. Soft cap of 50 members per account.
// ===================================================================
export const ROLE_RANK = { member: 1, admin: 2, owner: 3 };
export const MAX_MEMBERS = 50;

// True if `role` meets or exceeds `min` in the hierarchy.
export function roleAtLeast(role, min) {
  return (ROLE_RANK[role] || 0) >= (ROLE_RANK[min] || 99);
}

// Membership row for an email, or null.
export async function getMembership(env, email) {
  const e = normalizeEmail(email);
  if (!e) return null;
  return env.DB.prepare('SELECT * FROM memberships WHERE email=?').bind(e).first();
}

// Count active members of an account.
export async function countAccountMembers(env, accountId) {
  const row = await env.DB
    .prepare("SELECT COUNT(*) c FROM memberships WHERE account_id=? AND status='active'")
    .bind(accountId).first();
  return (row && row.c) || 0;
}

// Ensure an email has an account. If it has no membership, create an account
// owned by this email plus an owner membership (idempotent). Used to migrate
// existing solo users lazily. Returns the membership row.
export async function ensureAccountForUser(env, user) {
  const email = normalizeEmail(user && user.email);
  if (!email) return null;
  const existing = await getMembership(env, email);
  if (existing) return existing;
  const accountId = crypto.randomUUID();
  const ts = now();
  try {
    await env.DB.prepare('INSERT INTO accounts (id, name, owner_email, plan, created_at) VALUES (?,?,?,?,?)')
      .bind(accountId, null, email, (user && user.plan) || null, ts).run();
    await env.DB.prepare('INSERT INTO memberships (email, account_id, role, status, invited_by, created_at) VALUES (?,?,?,?,?,?)')
      .bind(email, accountId, 'owner', 'active', null, ts).run();
  } catch (_) { /* race: another request created it; re-read below */ }
  return (await getMembership(env, email)) || { email, account_id: accountId, role: 'owner', status: 'active' };
}

// Gate: require the session user to be an active member of their account with at
// least `minRole`. Returns { user, membership } or { response }. NOT yet wired
// into endpoints (Phase 1 ships dark); Phase 4 adds enforcement everywhere.
export async function requireRole(request, env, minRole = 'member') {
  const user = await getUserFromSession(request, env);
  if (!user) return { response: unauthorized('sign in required') };
  const membership = await ensureAccountForUser(env, user);
  if (!membership || membership.status !== 'active') return { response: json({ error: 'no_account' }, 403) };
  if (!roleAtLeast(membership.role, minRole)) return { response: json({ error: 'forbidden' }, 403) };
  return { user, membership };
}

// Resolve the account context for a session user: membership, account row, and
// the owner email that app_data is keyed by. All members of an account share
// the owner's app_data row, so one account = one shared workspace. Falls back to
// the user's own email when the account row is missing (defensive).
export async function getAccountContext(env, user) {
  const membership = await ensureAccountForUser(env, user);
  if (!membership) return null;
  const account = await env.DB.prepare('SELECT * FROM accounts WHERE id=?')
    .bind(membership.account_id).first();
  const ownerEmail = (account && account.owner_email) || normalizeEmail(user && user.email);
  return { membership, account, ownerEmail };
}
