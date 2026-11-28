import { sha256Hex } from './util.js';

const paymentIdPattern = /^pay_[A-Za-z0-9]{1,128}$/;
const orderIdPattern = /^order_[A-Za-z0-9]{1,128}$/;
const successEventPattern = /^(?:payment|payment_link|order)\.(?:[a-z0-9_]{1,32}_)?(?:captured|paid|success|successful|succeeded|completed)$/;
const reviewKeyPattern = /^sha256:[a-f0-9]{64}$/;
const newConflict = `q.payment_id IS NOT NULL
  AND (q.amount <> excluded.amount OR q.currency <> excluded.currency)
  AND (q.conflict_amount IS NOT excluded.amount OR q.conflict_currency IS NOT excluded.currency)`;
const newReviewReason = `(excluded.reason = 'link_validation_failed' AND q.reason <> excluded.reason)
  OR (excluded.reason IN ('missing_link_catalogue', 'unexpected_success')
      AND q.reason IN ('legacy_success', 'verified_link'))`;

export function isReconciliationCursor(value) {
  return paymentIdPattern.test(value) || reviewKeyPattern.test(value);
}

export function isPaymentSuccess(eventType) {
  return typeof eventType === 'string' && successEventPattern.test(eventType);
}

function capturedPayment(event) {
  const payment = event.payload?.payment?.entity;
  if (typeof payment?.id !== 'string' || !paymentIdPattern.test(payment.id) ||
      payment.status !== 'captured' || (payment.captured !== undefined && payment.captured !== true) ||
      !Number.isSafeInteger(payment.amount) || payment.amount <= 0 ||
      typeof payment.currency !== 'string' || !/^[A-Z]{3}$/.test(payment.currency)) return null;

  if (event.event === 'order.paid') {
    const order = event.payload?.order?.entity;
    if (typeof order?.id !== 'string' || !orderIdPattern.test(order.id) ||
        order.id !== payment.order_id || order.status !== 'paid') return null;
  }
  return payment;
}

export async function enqueuePaymentReview(db, event, raw, reason, receivedAt) {
  const payment = capturedPayment(event);
  const key = payment?.id ?? 'sha256:' + await sha256Hex(raw);
  // Preserve the first observation. Only distinct contradictory evidence reopens review.
  const result = await db.prepare(`INSERT INTO legacy_payment_reconciliation AS q
    (review_key, payment_id, event_type, reason, amount, currency, received_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(review_key) DO UPDATE SET
      conflict_amount = CASE WHEN ${newConflict} THEN excluded.amount ELSE q.conflict_amount END,
      conflict_currency = CASE WHEN ${newConflict} THEN excluded.currency ELSE q.conflict_currency END,
      conflict_at = CASE WHEN ${newConflict} THEN excluded.received_at ELSE q.conflict_at END,
      reason = CASE WHEN ${newReviewReason} THEN excluded.reason ELSE q.reason END,
      event_type = CASE WHEN ${newReviewReason} THEN excluded.event_type ELSE q.event_type END,
      review_version = q.review_version + 1,
      resolved_at = NULL, resolution_ref = NULL
    WHERE (${newConflict}) OR (${newReviewReason})`)
    .bind(key, payment?.id ?? null, event.event, payment ? reason : 'malformed_success',
      payment?.amount ?? null, payment?.currency ?? null, receivedAt).run();
  if (!result.success) throw new Error('reconciliation_write_failed');
  return Boolean(payment);
}

export async function hasPaymentReviewConflict(db, paymentId) {
  return Boolean(await db.prepare(
    'SELECT 1 FROM legacy_payment_reconciliation WHERE payment_id = ? AND conflict_at IS NOT NULL'
  ).bind(paymentId).first());
}
