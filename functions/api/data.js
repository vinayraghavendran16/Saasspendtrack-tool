// Per-account app data (subscriptions, invoices, settings).
//   GET  /api/data -> the signed-in user's saved state (or { empty:true })
//   PUT  /api/data -> replace it (entitled users only)
// This is what makes data follow the user across devices instead of living
// only in one browser's localStorage.
import { json, getUserFromSession, requireEntitledRole, getAccountContext, now } from '../_shared/util.js';

const MAX_BYTES = 1_500_000; // generous cap for a single account's state

export async function onRequestGet({ request, env }) {
  const user = await getUserFromSession(request, env);
  if (!user) return json({ error: 'auth' }, 401);
  // Key app_data by the account owner so every member shares one workspace.
  // For a solo user, the owner email is their own email (zero change).
  const ctx = await getAccountContext(env, user);
  // A removed/suspended member can't read the shared workspace (reads stay open for
  // expired-but-active members, which is why this checks status, not entitlement).
  if (ctx && ctx.membership && ctx.membership.status !== 'active') return json({ error: 'no_account' }, 403);
  const key = (ctx && ctx.ownerEmail) || user.email;
  const row = await env.DB.prepare('SELECT data FROM app_data WHERE email=?')
    .bind(key).first();
  if (!row || !row.data) return json({ empty: true });
  try {
    return json({ data: JSON.parse(row.data) });
  } catch {
    return json({ empty: true });
  }
}

export async function onRequestPut({ request, env }) {
  // Only entitled, active members can write (expired trials are read-only).
  const gate = await requireEntitledRole(request, env, 'member');
  if (gate.response) return gate.response;
  const { user } = gate;

  const body = await request.text();
  if (body.length > MAX_BYTES) return json({ error: 'too_large' }, 413);
  try { JSON.parse(body); } catch { return json({ error: 'bad_json' }, 400); }

  // Write to the account owner's row so all members share one workspace.
  const ctx = await getAccountContext(env, user);
  const key = (ctx && ctx.ownerEmail) || user.email;
  await env.DB.prepare(
    `INSERT INTO app_data (email, data, updated_at) VALUES (?,?,?)
     ON CONFLICT(email) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
  ).bind(key, body, now()).run();

  return json({ ok: true });
}
