// POST /api/account/member-remove — remove a teammate from the workspace
// (owner/admin only). Frees a seat; the person can be re-invited later and falls
// back to their own solo account on next sign-in. Rules:
//   - The owner cannot be removed, and you cannot remove yourself.
//   - An admin may remove members only; only the owner may remove an admin.
import { json, requireRole, getMembership, normalizeEmail } from '../../_shared/util.js';

export async function onRequestPost({ request, env }) {
  const gate = await requireRole(request, env, 'admin');
  if (gate.response) return gate.response;
  const { user, membership } = gate;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json', message: 'Could not read the request.' }, 400); }
  const email = normalizeEmail(body && body.email);
  if (!email) return json({ error: 'bad_email', message: 'A teammate email is required.' }, 400);
  if (email === normalizeEmail(user.email)) return json({ error: 'self', message: 'You cannot remove yourself.' }, 400);

  const target = await getMembership(env, email);
  if (!target || target.account_id !== membership.account_id) {
    return json({ error: 'not_found', message: 'That teammate is not in your workspace.' }, 404);
  }
  if (target.role === 'owner') return json({ error: 'owner', message: 'The owner cannot be removed.' }, 403);
  if (membership.role !== 'owner' && target.role === 'admin') {
    return json({ error: 'forbidden', message: 'Only the owner can remove an admin.' }, 403);
  }

  try {
    const result = await env.DB.prepare("DELETE FROM memberships WHERE email=? AND account_id=? AND role=? AND role<>'owner' AND EXISTS (SELECT 1 FROM memberships actor WHERE actor.email=? AND actor.account_id=? AND actor.status='active' AND (actor.role='owner' OR (actor.role='admin' AND memberships.role='member')))")
      .bind(email, membership.account_id, target.role, normalizeEmail(user.email), membership.account_id).run();
    if (result.meta?.changes !== 1) return json({error:'membership_changed'},409);
  } catch (err) {
    console.error('member-remove failed', err && err.message);
    return json({ error: 'server', message: 'Could not remove the teammate. Please try again.' }, 500);
  }
  return json({ ok: true, removed: email });
}
