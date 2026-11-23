// Workspace AI consent. Disabled by default; only owners/admins may change it.
import { json, requireRole, now } from '../../_shared/util.js';
const CONSENT_VERSION = 'workspace-ai-v1';
export async function onRequestGet({ request, env }) {
  const gate = await requireRole(request, env, 'member');
  if (gate.response) return gate.response;
  try {
    const row = await env.DB.prepare(
      'SELECT enabled, consent_version, changed_at FROM workspace_ai_settings WHERE account_id=?',
    ).bind(gate.membership.account_id).first();
    return json({ enabled: row?.enabled === 1, consentVersion: row?.consent_version || null, changedAt: row?.changed_at || null });
  } catch (_) { return json({ enabled: false, unavailable: true }, 503); }
}
export async function onRequestPost({ request, env }) {
  const gate = await requireRole(request, env, 'admin');
  if (gate.response) return gate.response;
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'invalid_json' }, 400); }
  if (typeof body?.enabled !== 'boolean' || body.consentVersion !== CONSENT_VERSION) {
    return json({ error: 'explicit_consent_required', consentVersion: CONSENT_VERSION }, 400);
  }
  const t = now();
  const accountId = gate.membership.account_id;
  try {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO workspace_ai_settings (account_id, enabled, consent_version, changed_by, changed_at) VALUES (?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET enabled=excluded.enabled, consent_version=excluded.consent_version, changed_by=excluded.changed_by, changed_at=excluded.changed_at',
      ).bind(accountId, body.enabled ? 1 : 0, CONSENT_VERSION, gate.user.email, t),
      env.DB.prepare(
        'INSERT INTO workspace_ai_consent_events (id, account_id, actor_email, enabled, consent_version, created_at) VALUES (?,?,?,?,?,?)',
      ).bind(crypto.randomUUID(), accountId, gate.user.email, body.enabled ? 1 : 0, CONSENT_VERSION, t),
    ]);
    return json({ enabled: body.enabled, consentVersion: CONSENT_VERSION });
  } catch (_) { return json({ error: 'consent_update_failed' }, 503); }
}
