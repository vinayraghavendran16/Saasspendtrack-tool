// GET /api/auth/verify?token=...
// Validates the one-time token, creates a session, sets the cookie, and
// redirects to the app.
import {
  sha256Hex, randomToken, now, DAY, SESSION_DAYS, sessionCookie,
} from '../../_shared/util.js';

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
  const row = await env.DB
    .prepare('SELECT * FROM login_tokens WHERE token_hash=?').bind(tokenHash).first();

  if (!row || row.used || row.expires_at < t) {
    return redirect(`${appUrl}/?auth=expired`);
  }

  // Burn the token (single use).
  await env.DB.prepare('UPDATE login_tokens SET used=1 WHERE token_hash=?').bind(tokenHash).run();

  // Create the session.
  const sid = randomToken(32);
  await env.DB.prepare(
    'INSERT INTO sessions (id, email, created_at, expires_at) VALUES (?,?,?,?)',
  ).bind(sid, row.email, t, t + SESSION_DAYS * DAY).run();
  await env.DB.prepare('UPDATE users SET last_login_at=? WHERE email=?').bind(t, row.email).run();

  return redirect(`${appUrl}/?auth=ok`, sessionCookie(sid));
}
