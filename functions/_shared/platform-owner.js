import { getUserFromSession, normalizeEmail, json } from './util.js';

// Separate from workspace ownership and legacy admin privileges.
// Explicit deployment configuration is mandatory; missing config denies access.
export function isPlatformOwner(env, user) {
  const configured = normalizeEmail(env.PLATFORM_OWNER_EMAIL);
  const actual = normalizeEmail(user?.email);
  return Boolean(configured && actual && configured === actual);
}

export async function requirePlatformOwner(request, env) {
  const headers = { 'Cache-Control': 'no-store' };
  const user = await getUserFromSession(request, env);
  if (!user) return { response: json({ error: 'unauthorized' }, 401, headers) };
  if (!isPlatformOwner(env, user)) return { response: json({ error: 'forbidden' }, 403, headers) };
  return { user };
}
