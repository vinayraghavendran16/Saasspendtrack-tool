-- No document contents, email addresses, raw session tokens or arbitrary metadata.
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  actor_key TEXT NOT NULL,
  event_name TEXT NOT NULL CHECK(event_name IN (
    'login','workspace_created','invite_accepted','subscription_saved',
    'contract_uploaded','extraction_completed','renewal_reviewed',
    'ai_completed','export_completed','trial_converted',
    'onboarding_viewed','pricing_viewed'
  )),
  occurred_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_events_workspace_time ON usage_events(account_id, occurred_at);
CREATE INDEX IF NOT EXISTS usage_events_time_name ON usage_events(occurred_at, event_name);
CREATE INDEX IF NOT EXISTS usage_events_workspace_actor ON usage_events(account_id, actor_key, occurred_at);
