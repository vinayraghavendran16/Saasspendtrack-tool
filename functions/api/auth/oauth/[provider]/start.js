import { authAppUrl } from '../../../../_shared/auth-url.js';
import { beginOAuth, oauthRedirect, providerConfig } from '../../../../_shared/oauth.js';
import { getUserFromSession, json, rateLimit } from '../../../../_shared/util.js';

async function start({request, env, params}, linking) {
  const provider = params.provider;
  if (env.OAUTH_ENABLED !== 'true' || !providerConfig(env, provider)) return json({error: 'oauth_unavailable'}, 404);
  const origin = authAppUrl(request, env);
  if (new URL(request.url).origin !== origin || (linking && request.headers.get('origin') !== origin)) {
    return json({error: 'invalid_origin'}, 403);
  }
  try {
    if (linking && !await getUserFromSession(request, env)) return json({error: 'sign_in_required'}, 401);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const limit = await rateLimit(env, 'oauth-start:' + ip, 30, 3600000, {failClosed: true});
    if (!limit.ok) return json({error: 'oauth_rate_limited'}, limit.unavailable ? 503 : 429);
    return await beginOAuth(request, env, provider, linking);
  } catch {
    return oauthRedirect(origin + '/?auth=oauth_error');
  }
}

export const onRequestGet = context => start(context, false);
export const onRequestPost = context => start(context, true);
