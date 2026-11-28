-- Additive. Apply after review and before deploying the reconciliation webhook.
CREATE TABLE IF NOT EXISTS legacy_payment_reconciliation (
  payment_id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('payment.captured', 'order.paid')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
  received_at INTEGER NOT NULL,
  resolved_at INTEGER CHECK (resolved_at IS NULL OR resolved_at >= received_at)
);
