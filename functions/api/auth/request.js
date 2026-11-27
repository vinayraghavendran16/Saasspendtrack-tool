import { authAppUrl } from '../../_shared/auth-url.js';
// POST /api/auth/request  { email }
// Creates the user on first sight (starts the trial), issues a one-time
// magic-link token, and emails the sign-in link.
import {
  json, badRequest, normalizeEmail, randomToken, sha256Hex,
  now, DAY, TRIAL_DAYS, TOKEN_MINUTES, rateLimit, getClientIp,
} from '../../_shared/util.js';
import { sendEmail, loginLinkEmail } from '../../_shared/email.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return badRequest('invalid json'); }
  const email = normalizeEmail(body?.email);
  if (!email) return badRequest('valid email required');

  // Abuse guard: cap sign-in emails per IP and per address.
  const ipRl = await rateLimit(env, 'authreq:ip:' + getClientIp(request), 20, 3600000, { failClosed: true });
  const emRl = await rateLimit(env, 'authreq:em:' + email, 5, 900000, { failClosed: true });
  if (!ipRl.ok || !emRl.ok) {
    return json({ ok: false, error: 'rate_limited', message: 'Too many sign-in requests. Please wait and try again.' }, 429);
  }

  const t = now();

  // Create the user (and start the trial) if new. INSERT OR IGNORE keeps the
  // original trial_ends_at on repeat sign-ins.
  await env.DB.prepare(
    'INSERT OR IGNORE INTO users (email, created_at, trial_ends_at, status) VALUES (?,?,?,?)',
  ).bind(email, t, t + TRIAL_DAYS * DAY, 'trial').run();

  // Issue a single-use token (store only its hash).
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    'INSERT INTO login_tokens (token_hash, email, expires_at, used) VALUES (?,?,?,0)',
  ).bind(tokenHash, email, t + TOKEN_MINUTES * 60000).run();

  const appUrl = authAppUrl(request, env);
  const link = `${appUrl}/api/auth/verify?token=${token}`;

  const mail = loginLinkEmail(link);
  const sent = await sendEmail(env, { to: email, subject: mail.subject, html: mail.html });

  // The welcome email is sent on first successful sign-in (verify.js), not here,
  // so people who never click the link don't get welcomed.

  // Always 200 so we don't leak which emails exist.
  return json({ ok: true, emailed: sent.ok !== false });
}
