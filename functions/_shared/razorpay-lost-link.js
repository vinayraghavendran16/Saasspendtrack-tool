import {ProviderError, requestPaymentLinks, validatePaymentLink} from './razorpay-provider.js';

// Read-only discovery. Zero results cannot authorize a retry or release.
export async function discoverLostLink(env, checkout, transport = fetch) {
  if (!/^[a-f0-9]{32}$/.test(checkout.id || '') || checkout.status !== 'reserved' || checkout.link_id) {
    throw new ProviderError('invalid_checkout');
  }
  const data = await requestPaymentLinks(env, transport, {referenceId: checkout.id});
  if (!Array.isArray(data?.payment_links)) throw new ProviderError('provider_response_invalid');
  if (data.payment_links.length === 0) throw new ProviderError('provider_link_not_found_manual_review');
  if (data.payment_links.length !== 1) throw new ProviderError('multiple_provider_links_manual_review');
  return validatePaymentLink(data.payment_links[0], checkout);
}
