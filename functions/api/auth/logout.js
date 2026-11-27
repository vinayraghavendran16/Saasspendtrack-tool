import { sessionStorageId } from '../../_shared/session-token.js';
// POST /api/auth/logout  -> destroy the session, clear the cookie.
import { json, parseCookies, clearSessionCookie } from '../../_shared/util.js';

export async function onRequestPost({ request, env }) {
  const sid = parseCookies(request).sst_session;
  const storedId = await sessionStorageId(sid);
  if (storedId) await env.DB.prepare('DELETE FROM sessions WHERE id IN (?,?)').bind(storedId,sid).run();
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}
