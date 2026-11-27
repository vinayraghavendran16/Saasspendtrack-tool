-- Additive only. Apply after isolated rehearsal and explicit release approval.
CREATE TABLE IF NOT EXISTS payment_ledger (
 payment_id TEXT PRIMARY KEY,
 link_id TEXT NOT NULL,
 customer_email TEXT NOT NULL,
 tier TEXT NOT NULL CHECK(tier IN ('founding','standard')),
 amount INTEGER NOT NULL CHECK(amount > 0),
 currency TEXT NOT NULL CHECK(length(currency)=3),
 recorded_at INTEGER NOT NULL,
 entitlement_until INTEGER NOT NULL CHECK(entitlement_until > recorded_at)
);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_customer ON payment_ledger(customer_email);
