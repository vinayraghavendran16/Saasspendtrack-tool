import { requirePlatformOwner } from '../../_shared/platform-owner.js';
import { json } from '../../_shared/util.js';

export async function onRequestGet({request,env}) {
  const gate = await requirePlatformOwner(request,env);
  if (gate.response) return gate.response;
  const configured = env.EMAIL_PROVIDER || 'zeptomail';
  const provider = ['zeptomail','resend'].includes(configured) ? configured : 'invalid';
  return json({
    provider,
    aggregationConfigured: typeof env.EMAIL_HEALTH?.writeDataPoint === 'function',
    metricsAvailable: false,
    deliveryVerified: false,
    status: 'unverified',
  },200,{'Cache-Control':'no-store'});
}
