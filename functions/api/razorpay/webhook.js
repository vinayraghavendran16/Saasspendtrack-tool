import { validatePaidLink } from '../../_shared/payment-policy.js';
import { recordUsage } from '../../_shared/usage.js';
import { getMembership } from '../../_shared/util.js';
import { enqueueLegacyPayment, legacyPaymentForReview } from '../../_shared/legacy-payment-reconciliation.js';
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

  if (evt?.event === 'payment.captured' || evt?.event === 'order.paid') {
    const payment = legacyPaymentForReview(evt);
    if (!payment) return new Response('invalid legacy payment event', { status: 422 });
    try {
      await enqueueLegacyPayment(env.DB, evt.event, payment, now());
    } catch {
      console.error('razorpay: legacy payment reconciliation unavailable');
      return new Response('reconciliation unavailable', { status: 503 });
    }
    return new Response('accepted for reconciliation', { status: 200 });
  }

  if (evt?.event !== 'payment_link.paid') return new Response('ignored', { status: 200 });
  let catalogue;
  try { catalogue = JSON.parse(env.RAZORPAY_PAYMENT_CATALOGUE || 'null'); }
  catch { return new Response('payment configuration unavailable', { status: 503 }); }
  if (!Array.isArray(catalogue) || !catalogue.length) return new Response('payment configuration unavailable', { status: 503 });
  const paid = validatePaidLink(evt, catalogue);
  if (!paid) return new Response('payment requires review', { status: 422 });
  const payment = evt.payload.payment.entity;
  const link = evt.payload.payment_link.entity;
  const email = normalizeEmail(link.customer?.email);
  if (!email || (payment.email && normalizeEmail(payment.email) !== email)) return new Response('customer requires review', { status: 422 });
  const {paymentId,linkId,amount,currency,tier} = paid;
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
