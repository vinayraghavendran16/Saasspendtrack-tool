// GET /api/me  -> entitlement for the current session (source of truth for the gate)
import { json, getUserFromSession, resolveEntitlement, getAccountContext } from '../_shared/util.js';

export async function onRequestGet({ request, env }) {
  const user = await getUserFromSession(request, env);
  if (!user) return json({ authenticated: false });
  const ent = await resolveEntitlement(env, user);
  let account = null;
  try {
    const ctx = await getAccountContext(env, user);
    if (ctx) account = {
      id: ctx.membership.account_id,
      role: ctx.membership.role,
      name: (ctx.account && ctx.account.name) || null,
      ownerEmail: ctx.ownerEmail,
      isOwner: ctx.membership.role === 'owner',
    };
  } catch (_) { /* accounts optional; never break the gate */ }
  return json({ authenticated: true, ...ent, account });
}
