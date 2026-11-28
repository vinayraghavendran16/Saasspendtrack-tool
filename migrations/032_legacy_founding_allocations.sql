CREATE TABLE legacy_founding_allocations (
 slot INTEGER PRIMARY KEY CHECK(slot BETWEEN 1 AND 25),
 account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id),
 evidence_ref TEXT NOT NULL UNIQUE CHECK(length(evidence_ref)>0),
 recorded_at INTEGER NOT NULL
);
CREATE TRIGGER legacy_founding_collision BEFORE INSERT ON legacy_founding_allocations
WHEN EXISTS(SELECT 1 FROM checkout_intents WHERE founding_slot=NEW.slot OR (account_id=NEW.account_id AND tier='founding' AND status IN ('reserved','created','paid')))
BEGIN SELECT RAISE(ABORT,'founding allocation collision'); END;
CREATE TRIGGER checkout_legacy_collision BEFORE INSERT ON checkout_intents
WHEN NEW.tier='founding' AND EXISTS(SELECT 1 FROM legacy_founding_allocations WHERE slot=NEW.founding_slot OR account_id=NEW.account_id)
BEGIN SELECT RAISE(ABORT,'historical founding allocation exists'); END;
CREATE TRIGGER legacy_founding_no_update BEFORE UPDATE ON legacy_founding_allocations
BEGIN SELECT RAISE(ABORT,'historical allocation immutable'); END;
CREATE TRIGGER legacy_founding_no_delete BEFORE DELETE ON legacy_founding_allocations
BEGIN SELECT RAISE(ABORT,'historical allocation retained'); END;
