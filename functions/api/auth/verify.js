// GET /api/auth/verify?token=...
// Validates the one-time token, creates a session, sets the cookie, and
// redirects to the app.
import {
  sha256Hex, randomToken, now, DAY, SESSION_DAYS, sessionCookie,
} from '../../_shared/util.js';
import { sendEmail, welcomeEmail } from '../../_shared/email.js';

function redirect(location, cookie) {
  const headers = { Location: location };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet({ request, env }) {
  const appUrl = (env.APP_URL || 'https://app.saasspendtrack.com').replace(/\/$/, '');
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!token) return redirect(`${appUrl}/?auth=invalid`);

  const tokenHash = await sha256Hex(token);
  const t = now();
  // Redeem atomically: only one concurrent request can consume this token.
  // D1/SQLite RETURNING gives us the email only when the update succeeds.
  const row = await env.DB.prepare(
    'UPDATE login_tokens SET used=1 WHERE token_hash=? AND used=0 AND expires_at>? RETURNING email',
  ).bind(tokenHash, t).first();
  if (!row) return redirect(`${appUrl}/?auth=expired`);

  // Create the session.
  const sid = randomToken(32);
  await env.DB.prepare(
    'INSERT INTO sessions (id, email, created_at, expires_at) VALUES (?,?,?,?)',
  ).bind(sid, row.email, t, t + SESSION_DAYS * DAY).run();
  await env.DB.prepare('UPDATE users SET last_login_at=? WHERE email=?').bind(t, row.email).run();

  // Welcome email, once, on first successful sign-in (best-effort).
  const welcomed = await env.DB.prepare('SELECT 1 FROM email_log WHERE email=? AND kind=?')
    .bind(row.email, 'welcome').first();
  if (!welcomed) {
    const w = welcomeEmail('', appUrl);
    const ok = await sendEmail(env, { to: row.email, subject: w.subject, html: w.html });
    if (ok.ok) {
      await env.DB.prepare('INSERT OR IGNORE INTO email_log (email, kind, sent_at) VALUES (?,?,?)')
        .bind(row.email, 'welcome', t).run();
    }
  }

  return redirect(`${appUrl}/?auth=ok`, sessionCookie(sid));
}
