CREATE TABLE IF NOT EXISTS ai_egress_audit (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES accounts(id),
 operation TEXT NOT NULL CHECK(operation IN ('model_discovery','messages')),
 outcome TEXT NOT NULL CHECK(outcome IN ('authorized','denied','http_success','http_failure','network_failure')),
 occurred_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_egress_account_time ON ai_egress_audit(account_id,occurred_at);
