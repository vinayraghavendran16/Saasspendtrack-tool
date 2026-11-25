import { isPlatformOwner } from '../_shared/platform-owner.js';
// GET /api/me -> effective account entitlement and current member identity.
import { json, getUserFromSession, resolveWorkspaceEntitlement, getAccountContext } from '../_shared/util.js';

export async function onRequestGet({ request, env }) {
  const user = await getUserFromSession(request, env);
  if (!user) return json({ authenticated: false });
  const unavailable = (status) => ({
    authenticated: true, email: user.email, entitled: false, status,
    plan: null, trialEndsAt: null, daysLeft: 0, account: null,
  });
  let ctx;
  let ent;
  try {
    ctx = await getAccountContext(env, user);
    if (!ctx) return json(unavailable('no_account'), 403);
    ent = await resolveWorkspaceEntitlement(env, user, ctx);
  } catch (_) {
    return json(unavailable('unavailable'), 503);
  }
  if (!ent) return json(unavailable('unavailable'), 503);
  return json({
    authenticated: true, ...ent,
    platformOwner: isPlatformOwner(env, user),
    account: {
      id: ctx.membership.account_id,
      role: ctx.membership.role,
      name: ctx.account.name || null,
      ownerEmail: ctx.ownerEmail,
      isOwner: ctx.membership.role === 'owner',
    },
  });
}
