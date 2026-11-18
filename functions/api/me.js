// GET /api/me  -> entitlement for the current session (source of truth for the gate)
import { json, getUserFromSession, resolveEntitlement } from '../_shared/util.js';

export async function onRequestGet({ request, env }) {
  const user = await getUserFromSession(request, env);
  if (!user) return json({ authenticated: false });
  const ent = await resolveEntitlement(env, user);
  return json({ authenticated: true, ...ent });
}
