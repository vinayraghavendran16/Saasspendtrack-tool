CREATE TABLE checkout_release_evidence (
 checkout_id TEXT PRIMARY KEY REFERENCES checkout_intents(id),
 link_id TEXT NOT NULL UNIQUE,
 provider_status TEXT NOT NULL CHECK(provider_status IN ('expired','cancelled')),
 amount_paid INTEGER NOT NULL CHECK(amount_paid=0),
 verified_at INTEGER NOT NULL
);
CREATE TRIGGER checkout_release_evidence_guard BEFORE INSERT ON checkout_release_evidence
WHEN NOT EXISTS(SELECT 1 FROM checkout_intents c JOIN checkout_provider_claims p ON p.checkout_id=c.id WHERE c.id=NEW.checkout_id AND c.link_id=NEW.link_id AND c.status='created' AND p.completed_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'invalid release evidence'); END;
CREATE TRIGGER checkout_release_evidence_no_update BEFORE UPDATE ON checkout_release_evidence BEGIN SELECT RAISE(ABORT,'immutable evidence'); END;
CREATE TRIGGER checkout_release_evidence_no_delete BEFORE DELETE ON checkout_release_evidence BEGIN SELECT RAISE(ABORT,'immutable evidence'); END;
DROP TRIGGER checkout_expiry_guard;
CREATE TRIGGER checkout_expiry_guard BEFORE UPDATE ON checkout_intents
WHEN NEW.status IN ('expired','cancelled') AND EXISTS(SELECT 1 FROM checkout_provider_claims WHERE checkout_id=OLD.id)
AND NOT EXISTS(SELECT 1 FROM checkout_release_evidence e WHERE e.checkout_id=OLD.id AND e.link_id=OLD.link_id AND e.provider_status=NEW.status)
BEGIN SELECT RAISE(ABORT,'provider reconciliation required'); END;
