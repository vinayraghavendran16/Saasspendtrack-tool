CREATE TABLE IF NOT EXISTS legacy_payment_ids (payment_id TEXT PRIMARY KEY NOT NULL);
INSERT OR IGNORE INTO legacy_payment_ids(payment_id)
SELECT rp_payment_id FROM users WHERE rp_payment_id IS NOT NULL AND rp_payment_id <> ''
AND NOT EXISTS (SELECT 1 FROM payment_ledger p WHERE p.payment_id=users.rp_payment_id);
CREATE TRIGGER IF NOT EXISTS reject_legacy_payment_replay
BEFORE INSERT ON payment_ledger
WHEN EXISTS (SELECT 1 FROM legacy_payment_ids WHERE payment_id=NEW.payment_id)
BEGIN SELECT RAISE(ABORT,'legacy payment requires reconciliation'); END;
