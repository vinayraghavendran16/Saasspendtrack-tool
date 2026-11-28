const paymentIdPattern = /^pay_[A-Za-z0-9]{1,128}$/;
const orderIdPattern = /^order_[A-Za-z0-9]{1,128}$/;

export function isReconciliationPaymentId(value) {
  return typeof value === 'string' && paymentIdPattern.test(value);
}

export function legacyPaymentForReview(event) {
  const payment = event.payload?.payment?.entity;
  if (!isReconciliationPaymentId(payment?.id) || payment.status !== 'captured' ||
      (payment.captured !== undefined && payment.captured !== true) ||
      !Number.isSafeInteger(payment.amount) || payment.amount <= 0 ||
      typeof payment.currency !== 'string' || !/^[A-Z]{3}$/.test(payment.currency)) return null;

  if (event.event === 'order.paid') {
    const order = event.payload?.order?.entity;
    if (typeof order?.id !== 'string' || !orderIdPattern.test(order.id) ||
        order.id !== payment.order_id || order.status !== 'paid') return null;
  }
  return payment;
}

export async function enqueueLegacyPayment(db, eventType, payment, receivedAt) {
  // The signed payment ID deduplicates retries and overlapping success events atomically.
  const result = await db.prepare(`INSERT INTO legacy_payment_reconciliation
    (payment_id, event_type, amount, currency, received_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(payment_id) DO NOTHING`)
    .bind(payment.id, eventType, payment.amount, payment.currency, receivedAt).run();
  if (!result.success) throw new Error('reconciliation_write_failed');
}
