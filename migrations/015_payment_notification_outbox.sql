CREATE TABLE IF NOT EXISTS payment_notification_outbox (
 payment_id TEXT NOT NULL REFERENCES payment_ledger(payment_id),
 kind TEXT NOT NULL CHECK(kind IN ('confirmation')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','leased','accepted','dead')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at INTEGER NOT NULL, lease_until INTEGER,
 PRIMARY KEY(payment_id,kind)
);
CREATE INDEX IF NOT EXISTS payment_notification_due ON payment_notification_outbox(status,next_attempt_at);
CREATE TRIGGER IF NOT EXISTS enqueue_payment_confirmation AFTER INSERT ON payment_ledger
BEGIN INSERT INTO payment_notification_outbox(payment_id,kind,next_attempt_at) VALUES(NEW.payment_id,'confirmation',NEW.recorded_at); END;
