CREATE TABLE checkout_provider_claims (
 checkout_id TEXT PRIMARY KEY REFERENCES checkout_intents(id),
 claimed_at INTEGER NOT NULL,
 provider_url TEXT,
 completed_at INTEGER,
 CHECK((provider_url IS NULL AND completed_at IS NULL) OR (provider_url IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE TRIGGER checkout_claim_guard BEFORE INSERT ON checkout_provider_claims
WHEN NOT EXISTS(SELECT 1 FROM checkout_intents c WHERE c.id=NEW.checkout_id AND c.status='reserved' AND c.expires_at>NEW.claimed_at)
BEGIN SELECT RAISE(ABORT,'invalid provider claim'); END;
CREATE TRIGGER checkout_claim_no_delete BEFORE DELETE ON checkout_provider_claims
BEGIN SELECT RAISE(ABORT,'provider claim retained'); END;
CREATE TRIGGER checkout_claim_update_guard BEFORE UPDATE ON checkout_provider_claims
WHEN OLD.completed_at IS NOT NULL OR NEW.checkout_id IS NOT OLD.checkout_id OR NEW.claimed_at IS NOT OLD.claimed_at OR NEW.completed_at IS NULL OR NEW.provider_url IS NULL
BEGIN SELECT RAISE(ABORT,'invalid provider completion'); END;
