const PROVIDERS = new Set(['zeptomail','resend','invalid']);
const OUTCOMES = new Set(['accepted','no_token','invalid_token_format','invalid_provider_endpoint','invalid_email_provider','provider_redirect','provider_rejected','timeout','redirect_rejected','timeout_unsupported','transport_error','unknown_failure']);

// Optional Analytics Engine binding. No recipient or message data is accepted.
export function recordEmailHealth(env, provider, outcome) {
  if (!PROVIDERS.has(provider) || !OUTCOMES.has(outcome)) return false;
  if (!env.EMAIL_HEALTH?.writeDataPoint) return false;
  try {
    env.EMAIL_HEALTH.writeDataPoint({indexes:[provider], blobs:[provider,outcome], doubles:[1]});
    return true;
  } catch {
    console.warn('email_health_aggregation_unavailable');
    return false;
  }
}
