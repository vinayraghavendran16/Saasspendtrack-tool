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
  if (!ctx || !ctx.ownerEmail) return json({ error: 'no_account' }, 403);
  const key = ctx.ownerEmail;
  const row = await env.DB.prepare('SELECT data, version FROM app_data WHERE email=?')
    .bind(key).first();
  if (!row || !row.data) return json({ empty: true, version: 0 });
  try {
    return json({ data: JSON.parse(row.data), version: row.version });
  } catch {
    return json({ error: 'invalid_saved_data' }, 503);
  }
}

export async function onRequestPut({ request, env }) {
  // Only entitled, active members can write (expired trials are read-only).
  const gate = await requireEntitledRole(request, env, 'member');
  if (gate.response) return gate.response;
  const { user } = gate;

  // Each write must declare the exact server revision it read. A missing
  // precondition is never interpreted as permission to overwrite.
  const rawVersion = request.headers.get('If-Match');
  if (rawVersion === null) return json({ error: 'version_required' }, 428);
  if (!/^(0|[1-9][0-9]*)$/.test(rawVersion)) return json({ error: 'invalid_version' }, 400);
  const expectedVersion = Number(rawVersion);
  if (!Number.isSafeInteger(expectedVersion)) return json({ error: 'invalid_version' }, 400);

  const body = await request.text();
  if (body.length > MAX_BYTES) return json({ error: 'too_large' }, 413);
  try { JSON.parse(body); } catch { return json({ error: 'bad_json' }, 400); }

  // Write to the account owner's row so all members share one workspace.
  const ctx = await getAccountContext(env, user);
  if (!ctx || !ctx.ownerEmail || ctx.membership.account_id !== gate.membership.account_id) return json({ error: 'no_account' }, 403);
  const key = ctx.ownerEmail;
  let saved;
  if (expectedVersion === 0) {
    // Exactly one first writer can create a workspace. Others receive 409.
    saved = await env.DB.prepare(
      'INSERT OR IGNORE INTO app_data (email, data, updated_at, version) VALUES (?,?,?,1) RETURNING version',
    ).bind(key, body, now()).first();
  } else {
    // Compare-and-swap in a single SQL statement prevents lost writes.
    saved = await env.DB.prepare(
      'UPDATE app_data SET data=?, updated_at=?, version=version+1 WHERE email=? AND version=? RETURNING version',
    ).bind(body, now(), key, expectedVersion).first();
  }
  if (!saved) return json({ error: 'version_conflict', message: 'This workspace changed since you opened it. Reload before saving.' }, 409);
  return json({ ok: true, version: saved.version });
}
