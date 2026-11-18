// POST /api/razorpay/webhook
// Razorpay calls this on payment events. We verify the signature, then flip the
// paying user to 'active'. Configure the same secret in the Razorpay dashboard.
import { hmacSha256Hex, safeEqual, now, normalizeEmail } from '../../_shared/util.js';
import { sendEmail, paidEmail } from '../../_shared/email.js';

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

  const type = evt.event || '';
  const payment = evt.payload?.payment?.entity || null;
  const link = evt.payload?.payment_link?.entity || null;

  // We only act on a captured/paid payment.
  const isPaid =
    type === 'payment.captured' ||
    type === 'payment_link.paid' ||
    (type === 'order.paid' && payment);
  if (!isPaid) return new Response('ignored', { status: 200 });

  const email = normalizeEmail(
    payment?.email || link?.customer?.email || evt.payload?.payment_link?.entity?.customer?.email,
  );
  const paymentId = payment?.id || link?.id || `evt_${evt.id || now()}`;
  const amount = payment?.amount ?? null;
  const currency = payment?.currency ?? null;
  const plan = currency === 'USD' ? 'annual-usd' : 'annual-inr';

  if (!email) {
    // Nothing to key on; acknowledge so Razorpay stops retrying, but log it.
    console.error('razorpay webhook: no email on', type, paymentId);
    return new Response('no email', { status: 200 });
  }

  // Idempotency: if we already recorded this payment id, do nothing.
  const dupe = await env.DB.prepare('SELECT email FROM users WHERE rp_payment_id=?')
    .bind(paymentId).first();
  if (dupe) return new Response('already processed', { status: 200 });

  const t = now();
  const existing = await env.DB.prepare('SELECT email FROM users WHERE email=?').bind(email).first();
  if (existing) {
    await env.DB.prepare(
      'UPDATE users SET status=?, plan=?, paid_at=?, rp_payment_id=?, amount_paid=?, currency=? WHERE email=?',
    ).bind('active', plan, t, paymentId, amount, currency, email).run();
  } else {
    // Paid without a prior trial — activate directly.
    await env.DB.prepare(
      'INSERT INTO users (email, created_at, trial_ends_at, status, plan, paid_at, rp_payment_id, amount_paid, currency) VALUES (?,?,?,?,?,?,?,?,?)',
    ).bind(email, t, t, 'active', plan, t, paymentId, amount, currency).run();
  }

  // Confirmation email, once.
  const already = await env.DB.prepare('SELECT 1 FROM email_log WHERE email=? AND kind=?')
    .bind(email, 'paid').first();
  if (!already) {
    const m = paidEmail();
    const ok = await sendEmail(env, { to: email, subject: m.subject, html: m.html });
    if (ok.ok) {
      await env.DB.prepare('INSERT OR IGNORE INTO email_log (email, kind, sent_at) VALUES (?,?,?)')
        .bind(email, 'paid', t).run();
    }
  }

  console.log('razorpay: activated', email, plan, amount, currency);
  return new Response('ok', { status: 200 });
}
