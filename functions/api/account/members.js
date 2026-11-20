// GET /api/account/members
// Lists the members of the signed-in user's account. Any member sees the roster;
// owners/admins also see pending invites. Read-only (Phase 5 adds mutate actions).
import { json, requireRole, MAX_MEMBERS } from '../../_shared/util.js';

export async function onRequestGet({ request, env }) {
  const gate = await requireRole(request, env, 'member');
  if (gate.response) return gate.response;
  const { membership } = gate;
  const accountId = membership.account_id;
  const isManager = membership.role === 'owner' || membership.role === 'admin';

  const membersRes = await env.DB.prepare(
    "SELECT email, role, status FROM memberships WHERE account_id=? ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, email",
  ).bind(accountId).all();
  const members = (membersRes && membersRes.results) || [];

  let invites = [];
  if (isManager) {
    const invRes = await env.DB.prepare(
      'SELECT email, role, expires_at FROM invites WHERE account_id=? AND used=0 AND expires_at > ? ORDER BY created_at DESC',
    ).bind(accountId, Date.now()).all();
    invites = (invRes && invRes.results) || [];
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
