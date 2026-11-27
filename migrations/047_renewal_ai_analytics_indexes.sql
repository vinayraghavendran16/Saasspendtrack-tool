CREATE INDEX IF NOT EXISTS ai_publication_account_time ON ai_recommendation_publications(account_id,published_at,recommendation_id,revision);
CREATE INDEX IF NOT EXISTS ai_action_revision_time ON ai_recommendation_actions(account_id,recommendation_id,revision,occurred_at);
CREATE INDEX IF NOT EXISTS ai_challenge_revision_time ON ai_recommendation_challenges(account_id,recommendation_id,revision,challenged_at);
