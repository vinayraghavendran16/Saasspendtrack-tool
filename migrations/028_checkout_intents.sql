-- Checkout foundation; not a live payment integration.
CREATE TABLE checkout_intents (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES accounts(id),
 owner_email TEXT NOT NULL,
 tier TEXT NOT NULL CHECK(tier IN ('founding','standard')),
 amount INTEGER NOT NULL,
 currency TEXT NOT NULL CHECK(currency='USD'),
 founding_slot INTEGER UNIQUE,
 status TEXT NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','created','paid','expired','cancelled')),
 link_id TEXT UNIQUE,
 payment_id TEXT UNIQUE REFERENCES payment_ledger(payment_id),
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL CHECK(expires_at>created_at),
 CHECK((tier='founding' AND amount=149900 AND ((status IN ('expired','cancelled') AND founding_slot IS NULL) OR (status NOT IN ('expired','cancelled') AND founding_slot IS NOT NULL AND founding_slot BETWEEN 1 AND 25))) OR (tier='standard' AND amount=200000 AND founding_slot IS NULL)),
 CHECK(status NOT IN ('created','paid') OR link_id IS NOT NULL),
 CHECK((status='paid' AND payment_id IS NOT NULL) OR (status!='paid' AND payment_id IS NULL))
);
CREATE UNIQUE INDEX checkout_one_pending ON checkout_intents(account_id) WHERE status IN ('reserved','created');
CREATE UNIQUE INDEX checkout_one_founding_paid ON checkout_intents(account_id) WHERE tier='founding' AND status='paid';
CREATE TABLE checkout_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 checkout_id TEXT NOT NULL REFERENCES checkout_intents(id),
 old_status TEXT,
 new_status TEXT NOT NULL,
 recorded_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE TRIGGER checkout_initial_guard BEFORE INSERT ON checkout_intents
WHEN NEW.status!='reserved' OR NEW.link_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM accounts a JOIN memberships m ON m.account_id=a.id WHERE a.id=NEW.account_id AND a.owner_email=NEW.owner_email AND m.email=NEW.owner_email AND m.role='owner' AND m.status='active')
BEGIN SELECT RAISE(ABORT,'invalid checkout owner or initial state'); END;
CREATE TRIGGER checkout_transition_guard BEFORE UPDATE ON checkout_intents
WHEN NEW.id IS NOT OLD.id OR NEW.account_id IS NOT OLD.account_id OR NEW.owner_email IS NOT OLD.owner_email OR NEW.tier IS NOT OLD.tier OR NEW.amount IS NOT OLD.amount OR NEW.currency IS NOT OLD.currency OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at OR (OLD.link_id IS NOT NULL AND NEW.link_id IS NOT OLD.link_id) OR (NEW.status NOT IN ('expired','cancelled') AND NEW.founding_slot IS NOT OLD.founding_slot) OR NOT ((OLD.status='reserved' AND NEW.status IN ('created','expired','cancelled')) OR (OLD.status='created' AND NEW.status IN ('paid','expired','cancelled')))
BEGIN SELECT RAISE(ABORT,'invalid checkout transition'); END;
CREATE TRIGGER checkout_payment_guard BEFORE UPDATE ON checkout_intents
WHEN NEW.status='paid' AND NOT EXISTS(SELECT 1 FROM payment_ledger p WHERE p.payment_id=NEW.payment_id AND p.link_id=NEW.link_id AND p.customer_email=NEW.owner_email AND p.amount=NEW.amount AND p.currency=NEW.currency AND p.tier=NEW.tier)
BEGIN SELECT RAISE(ABORT,'payment mismatch'); END;
CREATE TRIGGER checkout_insert_audit AFTER INSERT ON checkout_intents BEGIN INSERT INTO checkout_events(checkout_id,new_status) VALUES(NEW.id,NEW.status); END;
CREATE TRIGGER checkout_update_audit AFTER UPDATE ON checkout_intents BEGIN INSERT INTO checkout_events(checkout_id,old_status,new_status) VALUES(NEW.id,OLD.status,NEW.status); END;
CREATE TRIGGER checkout_no_delete BEFORE DELETE ON checkout_intents BEGIN SELECT RAISE(ABORT,'checkout history retained'); END;
CREATE TRIGGER checkout_events_no_update BEFORE UPDATE ON checkout_events BEGIN SELECT RAISE(ABORT,'immutable audit'); END;
CREATE TRIGGER checkout_events_no_delete BEFORE DELETE ON checkout_events BEGIN SELECT RAISE(ABORT,'immutable audit'); END;
