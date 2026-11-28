import { recordUsage } from '../_shared/usage.js';
// Per-account app data (subscriptions, invoices, settings).
//   GET  /api/data -> the signed-in user's saved state (or { empty:true })
//   PUT  /api/data -> replace it (entitled users only)
// This is what makes data follow the user across devices instead of living
// only in one browser's localStorage.
import { json, getUserFromSession, requireEntitledRole, getAccountContext, now } from '../_shared/util.js';

const MAX_BYTES = 1_500_000; // generous cap for a single account's state

// Preserve compatibility with older object-shaped snapshots, but reject values
// that cannot represent workspace state or have malformed core collections.
function validSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  for (const key of ['subscriptions', 'invoices', 'employees']) {
    if (Object.hasOwn(value, key) && (!Array.isArray(value[key]) ||
        value[key].some(item => !item || typeof item !== 'object' || Array.isArray(item)))) return false;
  }
  if (Object.hasOwn(value, 'settings') &&
      (!value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings))) return false;
  return true;
}

const SUPPORTED_CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

function monetaryRecords(snapshot) {
  return [...(snapshot.subscriptions || []), ...(snapshot.invoices || [])];
}

function workspaceCurrency(snapshot) {
  const code = snapshot.settings?.currency ?? 'USD';
  return typeof code === 'string' && SUPPORTED_CURRENCIES.has(code) ? code : null;
}

function validCurrency(snapshot, code) {
  return code !== null && monetaryRecords(snapshot).every(({ currency }) =>
    currency == null || currency === '' ||
    (typeof currency === 'string' && currency.toUpperCase() === code));
}

function versionConflict() {
  return json({ error: 'version_conflict', message: 'This workspace changed since you opened it. Reload before saving.' }, 409);
}

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
  if (!row) return json({ empty: true, version: 0, workspaceId: ctx.membership.account_id });
  try {
    const snapshot = JSON.parse(row.data);
    if (!validSnapshot(snapshot) || !Number.isSafeInteger(row.version) || row.version < 1) throw new Error('invalid snapshot');
    const needsCurrencyReview = !validCurrency(snapshot, workspaceCurrency(snapshot));
    return json({
      data: snapshot,
      version: row.version,
      workspaceId: ctx.membership.account_id,
      ...(needsCurrencyReview ? {
        needsCurrencyReview: true,
        canCorrectCurrency: ctx.membership.role === 'owner',
      } : {}),
    });
  } catch {
    return json({ error: 'invalid_saved_data' }, 503);
  }
}

export async function onRequestPut({ request, env }) {
  // Only entitled, active members can write (expired trials are read-only).
  const correction = request.headers.get('X-Workspace-Action') === 'correct-currency';
  const gate = await requireEntitledRole(request, env, correction ? 'owner' : 'member');
  if (gate.response) return gate.response;
  const { user } = gate;

  // Each write must declare the exact server revision it read. A missing
  // precondition is never interpreted as permission to overwrite.
  const rawVersion = request.headers.get('If-Match');
  if (rawVersion === null) return json({ error: 'version_required' }, 428);
  if (!/^(0|[1-9][0-9]*)$/.test(rawVersion)) return json({ error: 'invalid_version' }, 400);
  const expectedVersion = Number(rawVersion);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion === Number.MAX_SAFE_INTEGER) return json({ error: 'invalid_version' }, 400);

  let body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BYTES) return json({ error: 'too_large' }, 413);
  let snapshot;
  try { snapshot = JSON.parse(body); } catch { return json({ error: 'bad_json' }, 400); }
  if (!validSnapshot(snapshot)) return json({ error: 'invalid_snapshot' }, 400);

  // Write to the account owner's row so all members share one workspace.
  const ctx = await getAccountContext(env, user);
  if (!ctx || !ctx.ownerEmail || ctx.membership.account_id !== gate.membership.account_id) return json({ error: 'no_account' }, 403);
  const key = ctx.ownerEmail;
  const code = correction ? snapshot.currency : workspaceCurrency(snapshot);
  if (correction && (snapshot.confirmed !== true || !SUPPORTED_CURRENCIES.has(code) ||
      snapshot.workspaceId !== ctx.membership.account_id || expectedVersion === 0)) {
    return json({ error: 'invalid_currency_confirmation' }, 400);
  }
  if (correction && ctx.membership.role !== 'owner') return json({ error: 'forbidden' }, 403);
  if (!correction && !validCurrency(snapshot, code)) {
    return json({
      error: 'invalid_currency',
      message: 'Subscriptions and invoices must use the same supported currency as the workspace.',
    }, 400);
  }

  let saved;
  let subscriptionsChanged = (snapshot.subscriptions || []).some(s => s.fromPreset !== true);
  if (expectedVersion === 0) {
    // Exactly one first writer can create a workspace. Others receive 409.
    saved = await env.DB.prepare(
      'INSERT OR IGNORE INTO app_data (email, data, updated_at, version) VALUES (?,?,?,1) RETURNING version',
    ).bind(key, body, now()).first();
  } else {
    const current = await env.DB.prepare('SELECT data, version FROM app_data WHERE email=?')
      .bind(key).first();
    if (current?.version !== expectedVersion) return versionConflict();
    let previous;
    try { previous = JSON.parse(current.data); } catch { previous = null; }
    if (!validSnapshot(previous)) return json({ error: 'invalid_saved_data' }, 503);
    subscriptionsChanged = JSON.stringify((previous.subscriptions || []).filter(s => s.fromPreset !== true)) !== JSON.stringify((snapshot.subscriptions || []).filter(s => s.fromPreset !== true));
    const previousCode = workspaceCurrency(previous);
    const needsReview = !validCurrency(previous, previousCode);
    if (correction) {
      if (!needsReview) return json({ error: 'currency_review_not_required' }, 409);
      const revised = {
        ...previous,
        settings: { ...previous.settings, currency: code },
      };
      for (const key of ['subscriptions', 'invoices']) {
        if (previous[key]) revised[key] = previous[key].map(record => ({ ...record, currency: code }));
      }
      body = JSON.stringify(revised);
      if (new TextEncoder().encode(body).byteLength > MAX_BYTES) return json({ error: 'too_large' }, 413);
    } else if (needsReview) {
      return json({ error: 'currency_review_required', message: 'A workspace owner must review the saved currency labels before editing.' }, 422);
    } else if (monetaryRecords(previous).length && previousCode !== code) {
      return json({
        error: 'currency_locked',
        message: 'The workspace currency cannot change while saved subscriptions or invoices exist.',
      }, 422);
    }

    // Compare-and-swap in a single SQL statement prevents lost writes.
    saved = await env.DB.prepare(
      'UPDATE app_data SET data=?, updated_at=?, version=version+1 WHERE email=? AND version=? RETURNING version',
    ).bind(body, now(), key, expectedVersion).first();
  }
  if (!saved) return versionConflict();
  if (!correction && subscriptionsChanged) {
    await recordUsage(env, {accountId:ctx.membership.account_id,email:user.email,eventName:'subscription_saved',eventId:String(saved.version)});
  }
  return json({ ok: true, version: saved.version });
}
