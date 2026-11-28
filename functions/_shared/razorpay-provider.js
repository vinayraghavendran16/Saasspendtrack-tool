const endpoint = 'https://api.razorpay.com/v1/payment_links';
const providerErrorCodes = new Set(['BAD_REQUEST_ERROR', 'GATEWAY_ERROR', 'SERVER_ERROR']);

export function providerConfigurationError(env) {
  if (env.CHECKOUT_ISOLATED_SANDBOX !== 'true' || env.CHECKOUT_PROVIDER_ENABLED !== 'true') return 'provider_disabled';
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return 'provider_configuration_missing';
  if (!/^rzp_test_[A-Za-z0-9]+$/.test(env.RAZORPAY_KEY_ID)) return 'invalid_test_credentials';
  return null;
}

export class ProviderError extends Error {}

function providerRequestError(code, phase, exception, response, data) {
  const error = new ProviderError(code);
  error.details = {phase, exception};
  if (response) {
    const providerCode = data?.error?.code;
    error.details.httpStatus = response.status;
    error.details.providerCode = providerErrorCodes.has(providerCode) ? providerCode : null;
  }
  return error;
}

function exceptionKind(error) {
  if (error instanceof TypeError) return 'TypeError';
  if (error instanceof SyntaxError) return 'SyntaxError';
  if (error instanceof DOMException) {
    if (['AbortError', 'TimeoutError', 'InvalidCharacterError'].includes(error.name)) return error.name;
    return 'DOMException';
  }
  return 'other';
}

export async function requestPaymentLinks(env, transport, {body, referenceId, signal} = {}) {
  const configurationError = providerConfigurationError(env);
  if (configurationError) throw new ProviderError(configurationError);
  const url = new URL(endpoint);
  if (referenceId) url.searchParams.set('reference_id', referenceId);
  let authorization;
  try {
    authorization = 'Basic ' + btoa(env.RAZORPAY_KEY_ID + ':' + env.RAZORPAY_KEY_SECRET);
  } catch (error) {
    throw providerRequestError('invalid_test_credentials', 'basic_auth_encoding', exceptionKind(error));
  }
  if (!signal) {
    try {
      signal = AbortSignal.timeout(10000);
    } catch (error) {
      throw providerRequestError('provider_network_failure', 'timeout_setup', exceptionKind(error));
    }
  }
  let response;
  try {
    response = await transport(url.href, {
      // Workers supports manual redirects. Never forward Razorpay credentials to a redirect target.
      method: body ? 'POST' : 'GET', redirect: 'manual', signal,
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    throw providerRequestError(signal.aborted ? 'provider_timeout' : 'provider_network_failure', 'fetch', exceptionKind(error));
  }
  if (response.status >= 300 && response.status < 400) {
    throw providerRequestError('provider_network_failure', 'redirect_blocked', null, response);
  }
  let data;
  try {
    data = await response.json();
  } catch (error) {
    if (signal.aborted) throw providerRequestError('provider_timeout', 'response_body', exceptionKind(error), response);
    if (response.ok) throw providerRequestError(error instanceof SyntaxError ? 'provider_invalid_json' : 'provider_network_failure', 'response_body', exceptionKind(error), response);
  }
  if (response.ok) return data;
  const description = typeof data?.error?.description === 'string' ? data.error.description.trim().toLowerCase() : '';
  const reject = code => providerRequestError(code, 'provider_response', null, response, data);
  if (description === 'the api key provided is invalid') throw reject('invalid_test_credentials');
  if ([401, 403].includes(response.status) || description === 'authentication failed') throw reject('provider_authentication_failed');
  if ([400, 422].includes(response.status)) {
    if (/(?:currency.{0,40}(?:not supported|not enabled|disabled)|unsupported currency)/.test(description)) {
      throw reject('provider_unsupported_currency');
    }
    throw reject('provider_validation_failed');
  }
  throw reject('provider_lookup_unavailable');
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
