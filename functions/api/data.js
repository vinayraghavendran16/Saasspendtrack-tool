// Per-account app data (subscriptions, invoices, settings).
//   GET  /api/data -> the signed-in user's saved state (or { empty:true })
//   PUT  /api/data -> replace it (entitled users only)
// This is what makes data follow the user across devices instead of living
// only in one browser's localStorage.
import { json, getUserFromSession, resolveEntitlement, now } from '../_shared/util.js';

const MAX_BYTES = 1_500_000; // generous cap for a single account's state

export async function onRequestGet({ request, env }) {
  const user = await getUserFromSession(request, env);
  if (!user) return json({ error: 'auth' }, 401);
  const row = await env.DB.prepare('SELECT data FROM app_data WHERE email=?')
    .bind(user.email).first();
  if (!row || !row.data) return json({ empty: true });
  try {
    return json({ data: JSON.parse(row.data) });
  } catch {
    return json({ empty: true });
  }
}

export async function onRequestPut({ request, env }) {
  const user = await getUserFromSession(request, env);
  if (!user) return json({ error: 'auth' }, 401);

  // Only let people with access write (expired trials are read-only).
  const ent = await resolveEntitlement(env, user);
  if (!ent.entitled) return json({ error: 'not_entitled' }, 403);

  const body = await request.text();
  if (body.length > MAX_BYTES) return json({ error: 'too_large' }, 413);
  try { JSON.parse(body); } catch { return json({ error: 'bad_json' }, 400); }

  await env.DB.prepare(
    `INSERT INTO app_data (email, data, updated_at) VALUES (?,?,?)
     ON CONFLICT(email) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
  ).bind(user.email, body, now()).run();

  return json({ ok: true });
}
