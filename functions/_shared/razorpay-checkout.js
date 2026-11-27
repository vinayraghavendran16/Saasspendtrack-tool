import {ProviderError, requestPaymentLinks, validatePaymentLink} from './razorpay-provider.js';

// Provider adapter only; not exposed as an endpoint.
export async function createProviderLink(env, checkout, transport=fetch) {
  const amount={founding:149900,standard:200000}[checkout.tier];
  if (!amount || checkout.amount!==amount || checkout.currency!=='USD' || checkout.status!=='reserved' || !/^[a-f0-9]{32}$/.test(checkout.id)) throw new ProviderError('invalid_checkout');
  const expiry=Math.floor(checkout.expires_at/1000);
  if (!Number.isSafeInteger(expiry) || expiry<=Math.floor(Date.now()/1000)+60) throw new ProviderError('checkout_expired');
  const link = await requestPaymentLinks(env, transport, {body: {
    amount, currency: 'USD', accept_partial: false, reference_id: checkout.id,
    expire_by: expiry, customer: {email: checkout.owner_email},
    notify: {sms: false, email: false}, reminder_enable: false,
    description: 'SaaS Spend Track annual subscription'
  }});
  const validated = validatePaymentLink(link, checkout);
  if (validated.status !== 'created') throw new ProviderError('provider_response_invalid');
  return validated;
}
