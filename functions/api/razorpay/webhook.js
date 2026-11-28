import { validatePaidLink } from '../../_shared/payment-policy.js';
import { recordUsage } from '../../_shared/usage.js';
import { getMembership } from '../../_shared/util.js';
import { enqueuePaymentReview, hasPaymentReviewConflict, isPaymentSuccess } from '../../_shared/legacy-payment-reconciliation.js';
// POST /api/razorpay/webhook
// Razorpay calls this on payment events. We verify the signature, then flip the
// paying user to 'active'. Configure the same secret in the Razorpay dashboard.
import { hmacSha256Hex, safeEqual, now, normalizeEmail } from '../../_shared/util.js';

export async function onRequestPost({ request, env }) {
  const raw = await request.text(); // raw body required for signature check
  const signature = request.headers.get('X-Razorpay-Signature') || '';
  const secret = env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) return new Response('webhook secret not configured', { status: 500 });
  const expected = await hmacSha256Hex(secret, raw);
  if (!safeEqual(expected, signature)) {
    return new Response('bad signature', { status: 401 });
  }

  let evt;
  try { evt = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }

  if (!isPaymentSuccess(evt?.event)) return new Response('ignored', { status: 200 });
  const linkEvent = evt.event === 'payment_link.paid';
  let catalogue;
  if (linkEvent) {
    try { catalogue = JSON.parse(env.RAZORPAY_PAYMENT_CATALOGUE || 'null'); }
    catch { catalogue = null; }
  }
  const hasCatalogue = Array.isArray(catalogue) && catalogue.length > 0;
  const paid = hasCatalogue ? validatePaidLink(evt, catalogue) : null;
  const email = paid ? normalizeEmail(evt.payload.payment_link.entity.customer?.email) : '';
  const paymentEmail = paid ? evt.payload.payment.entity.email : null;
  const customerMatches = email && (!paymentEmail || normalizeEmail(paymentEmail) === email);
  let reason = 'unexpected_success';
  if (evt.event === 'payment.captured' || evt.event === 'order.paid') reason = 'legacy_success';
  if (linkEvent) {
    if (!hasCatalogue) reason = 'missing_link_catalogue';
    else reason = paid && customerMatches ? 'verified_link' : 'link_validation_failed';
  }
  let hasPayment;
  try {
    hasPayment = await enqueuePaymentReview(env.DB, evt, raw, reason, now());
  } catch {
    console.error('razorpay: payment reconciliation unavailable');
    return new Response('reconciliation unavailable', { status: 503 });
  }
  if (!hasPayment) return new Response('malformed payment success recorded for review', { status: 422 });
  if (!linkEvent || !hasCatalogue) return new Response('accepted for reconciliation', { status: 200 });
  if (!paid) return new Response('payment requires review', { status: 422 });
  if (!customerMatches) return new Response('customer requires review', { status: 422 });
  const {paymentId,linkId,amount,currency,tier} = paid;
  if (await hasPaymentReviewConflict(env.DB, paymentId)) {
    return new Response('accepted for reconciliation', { status: 200 });
  }
  const plan = currency === 'USD' ? 'annual-usd' : 'annual-inr';
  const t = now();
  const existing = await env.DB.prepare('SELECT email, status, paid_at FROM users WHERE email=?').bind(email).first();
  // D1 batch is transactional. A duplicate ledger primary key rolls back the entire batch.
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO payment_ledger (payment_id,link_id,customer_email,tier,amount,currency,recorded_at,entitlement_until) SELECT ?,?,?,?,?,?,?, CAST(strftime(\'%s\', datetime(MAX(?,COALESCE(MAX(entitlement_until),0))/1000, \'unixepoch\', CASE WHEN strftime(\'%m-%d\',MAX(?,COALESCE(MAX(entitlement_until),0))/1000,\'unixepoch\')=\'02-29\' THEN \'+365 days\' ELSE \'+12 months\' END)) AS INTEGER)*1000 FROM payment_ledger WHERE customer_email=?').bind(paymentId,linkId,email,tier,amount,currency,t,t,t,email),
      env.DB.prepare('INSERT INTO users (email,created_at,trial_ends_at,status,plan,paid_at,rp_payment_id,amount_paid,currency) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET status=excluded.status,plan=excluded.plan,paid_at=excluded.paid_at,rp_payment_id=excluded.rp_payment_id,amount_paid=excluded.amount_paid,currency=excluded.currency').bind(email,t,t,'active',plan,t,paymentId,amount,currency)
    ]);
  } catch (err) {
    if (await hasPaymentReviewConflict(env.DB, paymentId)) {
      return new Response('accepted for reconciliation', { status: 200 });
    }
    const prior = await env.DB.prepare('SELECT customer_email,link_id,amount,currency,tier FROM payment_ledger WHERE payment_id=?').bind(paymentId).first();
    if (prior && prior.customer_email===email && prior.link_id===linkId && prior.amount===amount && prior.currency===currency && prior.tier===tier) return new Response('already processed', {status:200});
    throw err;
  }

  if (existing && !existing.paid_at && existing.status !== 'active') {
    try {
      const membership = await getMembership(env,email);
      if (membership?.role === 'owner' && membership.status === 'active') {
        await recordUsage(env,{accountId:membership.account_id,email,eventName:'trial_converted',eventId:membership.account_id});
      }
    } catch (_) { console.warn('Conversion analytics unavailable'); }
  }

  // Migration 015 enqueues confirmation atomically with the payment ledger.
  // The scheduled worker is the sole sender; never send directly here.

  console.log('razorpay: payment recorded');
  return new Response('ok', { status: 200 });
}
