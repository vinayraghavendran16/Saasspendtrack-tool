// POST /api/account/member-role — change a teammate's role (owner/admin only).
// Body: { email, role } where role is 'member' | 'admin'. 'owner' is never settable
// here (ownership transfer is deliberately not exposed). Rules:
//   - An admin may manage members only; only the owner may grant/change admins.
//   - The owner's role cannot be changed, and you cannot change your own role.
import { json, requireRole, getMembership, normalizeEmail } from '../../_shared/util.js';

export async function onRequestPost({ request, env }) {
  const gate = await requireRole(request, env, 'admin');
  if (gate.response) return gate.response;
  const { user, membership } = gate;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json', message: 'Could not read the request.' }, 400); }
  const email = normalizeEmail(body && body.email);
  const role = String((body && body.role) || '').toLowerCase();
  if (!email) return json({ error: 'bad_email', message: 'A teammate email is required.' }, 400);
  if (!['member', 'admin'].includes(role)) return json({ error: 'bad_role', message: 'Role must be member or admin.' }, 400);
  if (email === normalizeEmail(user.email)) return json({ error: 'self', message: 'You cannot change your own role.' }, 400);

  const target = await getMembership(env, email);
  if (!target || target.account_id !== membership.account_id) {
    return json({ error: 'not_found', message: 'That teammate is not in your workspace.' }, 404);
  }
  if (target.role === 'owner') return json({ error: 'owner', message: 'The owner role cannot be changed here.' }, 403);
  // An admin may only touch members; only the owner may create or change admins.
  if (membership.role !== 'owner' && (target.role === 'admin' || role === 'admin')) {
    return json({ error: 'forbidden', message: 'Only the owner can manage admins.' }, 403);
  }
  if (target.role === role) return json({ ok: true, email, role, unchanged: true });

  try {
    const result = await env.DB.prepare("UPDATE memberships SET role=? WHERE email=? AND account_id=? AND role=? AND status='active' AND EXISTS (SELECT 1 FROM memberships actor WHERE actor.email=? AND actor.account_id=? AND actor.status='active' AND (actor.role='owner' OR (actor.role='admin' AND memberships.role='member' AND ?='member')))")
      .bind(role, email, membership.account_id, target.role, normalizeEmail(user.email), membership.account_id, role).run();
    if (result.meta?.changes !== 1) return json({error:'membership_changed'},409);
  } catch (err) {
    console.error('member-role update failed', err && err.message);
    return json({ error: 'server', message: 'Could not update the role. Please try again.' }, 500);
  }
  return json({ ok: true, email, role });
}
