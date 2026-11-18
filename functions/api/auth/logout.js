// POST /api/auth/logout  -> destroy the session, clear the cookie.
import { json, parseCookies, clearSessionCookie } from '../../_shared/util.js';

export async function onRequestPost({ request, env }) {
  const sid = parseCookies(request).sst_session;
  if (sid) await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run();
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}
