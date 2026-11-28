-- Until provider reconciliation is implemented, claimed checkouts remain locked.
CREATE TRIGGER checkout_expiry_guard BEFORE UPDATE ON checkout_intents
WHEN NEW.status IN ('expired','cancelled') AND EXISTS (
 SELECT 1 FROM checkout_provider_claims WHERE checkout_id=OLD.id
)
BEGIN SELECT RAISE(ABORT,'provider reconciliation required'); END;
