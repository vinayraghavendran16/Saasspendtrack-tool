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
