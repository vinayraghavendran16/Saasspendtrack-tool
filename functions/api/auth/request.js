// POST /api/auth/request  { email }
// Creates the user on first sight (starts the trial), issues a one-time
// magic-link token, and emails the sign-in link.
import {
  json, badRequest, normalizeEmail, randomToken, sha256Hex,
  now, DAY, TRIAL_DAYS, TOKEN_MINUTES,
} from '../../_shared/util.js';
import { sendEmail, loginLinkEmail, welcomeEmail } from '../../_shared/email.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return badRequest('invalid json'); }
  const email = normalizeEmail(body.email);
  if (!email) return badRequest('valid email required');

  const t = now();

  // Create the user (and start the trial) if new. INSERT OR IGNORE keeps the
  // original trial_ends_at on repeat sign-ins.
  const existed = await env.DB.prepare('SELECT email FROM users WHERE email=?').bind(email).first();
  if (!existed) {
    await env.DB.prepare(
      'INSERT INTO users (email, created_at, trial_ends_at, status) VALUES (?,?,?,?)',
    ).bind(email, t, t + TRIAL_DAYS * DAY, 'trial').run();
  }

  // Issue a single-use token (store only its hash).
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    'INSERT INTO login_tokens (token_hash, email, expires_at, used) VALUES (?,?,?,0)',
  ).bind(tokenHash, email, t + TOKEN_MINUTES * 60000).run();

  const appUrl = (env.APP_URL || 'https://app.saasspendtrack.com').replace(/\/$/, '');
  const link = `${appUrl}/api/auth/verify?token=${token}`;

  const mail = loginLinkEmail(link);
  const sent = await sendEmail(env, { to: email, subject: mail.subject, html: mail.html });

  // Fire the welcome email once, on first signup (best-effort).
  if (!existed) {
    const already = await env.DB.prepare('SELECT 1 FROM email_log WHERE email=? AND kind=?')
      .bind(email, 'welcome').first();
    if (!already) {
      const w = welcomeEmail();
      const ok = await sendEmail(env, { to: email, subject: w.subject, html: w.html });
      if (ok.ok) {
        await env.DB.prepare('INSERT OR IGNORE INTO email_log (email, kind, sent_at) VALUES (?,?,?)')
          .bind(email, 'welcome', t).run();
      }
    }
  }

  // Always 200 so we don't leak which emails exist.
  return json({ ok: true, emailed: sent.ok !== false });
}
