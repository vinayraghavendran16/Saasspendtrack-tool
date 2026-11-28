import { providerConfig } from '../../../_shared/oauth.js';
import { json } from '../../../_shared/util.js';

export function onRequestGet({env}) {
  return json({providers: env.OAUTH_ENABLED === 'true'
    ? ['google', 'microsoft'].filter(provider => providerConfig(env, provider))
    : []});
}
