-- Development-only D1 migration: workspace AI consent. Never apply to production without approval.
CREATE TABLE IF NOT EXISTS workspace_ai_settings (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  consent_version TEXT,
  changed_by TEXT,
  changed_at INTEGER
);
CREATE TABLE IF NOT EXISTS workspace_ai_consent_events (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  actor_email TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0,1)),
  consent_version TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_consent_account ON workspace_ai_consent_events(account_id,created_at);
