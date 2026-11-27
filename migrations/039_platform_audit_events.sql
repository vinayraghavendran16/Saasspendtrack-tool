CREATE TABLE IF NOT EXISTS platform_audit_events (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 id TEXT NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
 occurred_at INTEGER NOT NULL CHECK(typeof(occurred_at)='integer' AND occurred_at>0),
 actor_type TEXT NOT NULL CHECK(actor_type IN ('user','service','system','ai')),
 actor_id TEXT NOT NULL CHECK(length(trim(actor_id)) BETWEEN 1 AND 256),
 initiator_id TEXT CHECK(initiator_id IS NULL OR length(initiator_id) BETWEEN 1 AND 256),
 mode TEXT NOT NULL CHECK(mode IN ('manual_ui','bulk_import','integration_sync','api','scheduled_job','ai_assisted','system')),
 action TEXT NOT NULL CHECK(length(action) BETWEEN 1 AND 80),
 entity_type TEXT NOT NULL CHECK(length(entity_type) BETWEEN 1 AND 80),
 entity_id TEXT NOT NULL CHECK(length(entity_id) BETWEEN 1 AND 256),
 outcome TEXT NOT NULL CHECK(outcome IN ('committed','denied','failed','observed','proposed')),
 correlation_id TEXT NOT NULL CHECK(length(correlation_id) BETWEEN 1 AND 128),
 batch_id TEXT CHECK(batch_id IS NULL OR length(batch_id) BETWEEN 1 AND 128),
 changed_fields_json TEXT NOT NULL CHECK(json_valid(changed_fields_json) AND json_type(changed_fields_json)='array' AND length(changed_fields_json)<=4096),
 schema_version INTEGER NOT NULL CHECK(schema_version=1),
 PRIMARY KEY(account_id,id)
);
CREATE INDEX IF NOT EXISTS platform_audit_time ON platform_audit_events(account_id,occurred_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS platform_audit_entity ON platform_audit_events(account_id,entity_type,entity_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_correlation ON platform_audit_events(account_id,correlation_id);
CREATE TRIGGER IF NOT EXISTS platform_audit_no_update BEFORE UPDATE ON platform_audit_events
BEGIN SELECT RAISE(ABORT,'audit event immutable'); END;
-- Delete is reserved for a future controlled retention/erasure mechanism; no delete API.
