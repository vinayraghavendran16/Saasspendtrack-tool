// GET /api/account/members
// Lists the members of the signed-in user's account. Any member sees the roster;
// owners/admins also see pending invites. Read-only (Phase 5 adds mutate actions).
import { json, requireRole, MAX_MEMBERS, normalizeEmail } from '../../_shared/util.js';

export async function onRequestGet({ request, env }) {
  const gate = await requireRole(request, env, 'member');
  if (gate.response) return gate.response;
  const { user, membership } = gate;
  const accountId = membership.account_id;
  const isManager = membership.role === 'owner' || membership.role === 'admin';
  const selfRow = { email: normalizeEmail(user && user.email), role: membership.role, status: 'active' };

  let members;
  try {
    const membersRes = await env.DB.prepare(
      "SELECT email, role, status FROM memberships WHERE account_id=? ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, email",
    ).bind(accountId).all();
    members = (membersRes && membersRes.results) || [];
  } catch (err) {
    // Accounts tables not migrated yet: degrade to the signed-in user as sole owner
    // rather than 500-ing the whole panel. Invites need the tables, so flag setup.
    console.error('members: roster query failed', err && err.message);
    return json({ members: [selfRow], invites: [], count: 1, cap: MAX_MEMBERS, role: membership.role, canManage: isManager, pendingSetup: true });
  }
  if (!members.length) members = [selfRow];

  let invites = [];
  if (isManager) {
    try {
      const invRes = await env.DB.prepare(
        'SELECT email, role, expires_at FROM invites WHERE account_id=? AND used=0 AND expires_at > ? ORDER BY created_at DESC',
      ).bind(accountId, Date.now()).all();
      invites = (invRes && invRes.results) || [];
    } catch (err) { console.error('members: invites query failed', err && err.message); invites = []; }
  }

  return json({
    members,
    invites,
    count: members.length,
    cap: MAX_MEMBERS,
    role: membership.role,
    canManage: isManager,
  });
}
