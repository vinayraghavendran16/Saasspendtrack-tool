CREATE TABLE IF NOT EXISTS workspace_ai_locks (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id),
 locked INTEGER NOT NULL CHECK(locked IN (0,1)),
 changed_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS workspace_ai_lock_events (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES accounts(id),
 actor_email TEXT NOT NULL,
 locked INTEGER NOT NULL CHECK(locked IN (0,1)),
 changed_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS ai_locked_insert BEFORE INSERT ON workspace_ai_settings
WHEN NEW.enabled=1 AND EXISTS(SELECT 1 FROM workspace_ai_locks WHERE account_id=NEW.account_id AND locked=1)
BEGIN SELECT RAISE(ABORT,'ai_locked'); END;
CREATE TRIGGER IF NOT EXISTS ai_locked_update BEFORE UPDATE ON workspace_ai_settings
WHEN NEW.enabled=1 AND EXISTS(SELECT 1 FROM workspace_ai_locks WHERE account_id=NEW.account_id AND locked=1)
BEGIN SELECT RAISE(ABORT,'ai_locked'); END;
