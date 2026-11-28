-- Additive. Apply after review and before deploying the reconciliation webhook.
CREATE TABLE IF NOT EXISTS legacy_payment_reconciliation (
  review_key TEXT PRIMARY KEY NOT NULL,
  payment_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'legacy_success', 'unexpected_success', 'malformed_success',
    'missing_link_catalogue', 'link_validation_failed', 'verified_link'
  )),
  amount INTEGER CHECK (amount > 0),
  currency TEXT CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
  received_at INTEGER NOT NULL,
  conflict_amount INTEGER CHECK (conflict_amount > 0),
  conflict_currency TEXT CHECK (conflict_currency GLOB '[A-Z][A-Z][A-Z]'),
  conflict_at INTEGER,
  review_version INTEGER NOT NULL DEFAULT 0,
  resolved_at INTEGER CHECK (resolved_at IS NULL OR resolved_at >= received_at),
  resolution_ref TEXT,
  CHECK ((payment_id IS NULL AND amount IS NULL AND currency IS NULL) OR
    (payment_id IS NOT NULL AND amount IS NOT NULL AND currency IS NOT NULL)),
  CHECK ((conflict_at IS NULL AND conflict_amount IS NULL AND conflict_currency IS NULL) OR
    (conflict_at IS NOT NULL AND conflict_amount IS NOT NULL AND conflict_currency IS NOT NULL)),
  CHECK ((resolved_at IS NULL AND resolution_ref IS NULL) OR
    (resolved_at IS NOT NULL AND resolution_ref IS NOT NULL AND length(resolution_ref) > 0))
);

-- Close the race between verified-link validation and its transactional entitlement write.
CREATE TRIGGER IF NOT EXISTS hold_conflicting_reconciliation_payment
BEFORE INSERT ON payment_ledger
WHEN EXISTS (
  SELECT 1 FROM legacy_payment_reconciliation
  WHERE payment_id = NEW.payment_id AND conflict_at IS NOT NULL
)
BEGIN SELECT RAISE(ABORT, 'payment evidence requires reconciliation'); END;
