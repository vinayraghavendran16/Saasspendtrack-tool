const endpoint = 'https://api.razorpay.com/v1/payment_links';

export function providerConfigurationError(env) {
  if (env.CHECKOUT_ISOLATED_SANDBOX !== 'true' || env.CHECKOUT_PROVIDER_ENABLED !== 'true') return 'provider_disabled';
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return 'provider_configuration_missing';
  if (!/^rzp_test_[A-Za-z0-9]+$/.test(env.RAZORPAY_KEY_ID)) return 'invalid_test_credentials';
  return null;
}

export class ProviderError extends Error {}

export async function requestPaymentLinks(env, transport, {body, referenceId, signal = AbortSignal.timeout(10000)} = {}) {
  const configurationError = providerConfigurationError(env);
  if (configurationError) throw new ProviderError(configurationError);
  const url = new URL(endpoint);
  if (referenceId) url.searchParams.set('reference_id', referenceId);
  let response;
  try {
    response = await transport(url.href, {
      method: body ? 'POST' : 'GET', redirect: 'error', signal,
      headers: {
        Authorization: 'Basic ' + btoa(env.RAZORPAY_KEY_ID + ':' + env.RAZORPAY_KEY_SECRET),
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ProviderError(signal.aborted ? 'provider_timeout' : 'provider_network_failure');
  }
  let data;
  try {
    data = await response.json();
  } catch (error) {
    if (signal.aborted) throw new ProviderError('provider_timeout');
    if (response.ok) throw new ProviderError(error instanceof SyntaxError ? 'provider_invalid_json' : 'provider_network_failure');
  }
  if (response.ok) return data;
  const description = typeof data?.error?.description === 'string' ? data.error.description.trim().toLowerCase() : '';
  if (description === 'the api key provided is invalid') throw new ProviderError('invalid_test_credentials');
  if ([401, 403].includes(response.status) || description === 'authentication failed') throw new ProviderError('provider_authentication_failed');
  if ([400, 422].includes(response.status)) {
    if (/(?:currency.{0,40}(?:not supported|not enabled|disabled)|unsupported currency)/.test(description)) {
      throw new ProviderError('provider_unsupported_currency');
    }
    throw new ProviderError('provider_validation_failed');
  }
  throw new ProviderError('provider_lookup_unavailable');
}

export function validatePaymentLink(link, checkout) {
  if (!link || !/^plink_[A-Za-z0-9]+$/.test(link.id || '') ||
      !['created', 'paid', 'expired', 'cancelled', 'partially_paid'].includes(link.status)) {
    throw new ProviderError('provider_response_invalid');
  }
  if (link.reference_id !== checkout.id) throw new ProviderError('provider_reference_mismatch');
  if (link.amount !== checkout.amount || link.currency !== checkout.currency) {
    throw new ProviderError('provider_amount_currency_mismatch');
  }
  if (String(link.customer?.email || '').trim().toLowerCase() !== checkout.owner_email) {
    throw new ProviderError('provider_customer_mismatch');
  }
  let url;
  try {
    url = new URL(link.short_url);
  } catch {
    throw new ProviderError('provider_url_invalid_manual_review');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'rzp.io' || url.username || url.password || url.port) {
    throw new ProviderError('provider_url_invalid_manual_review');
  }
  return {linkId: link.id, url: url.href, status: link.status};
}
