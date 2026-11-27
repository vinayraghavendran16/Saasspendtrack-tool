CREATE TABLE IF NOT EXISTS ai_challenge_submissions (
 account_id TEXT NOT NULL, challenge_id TEXT NOT NULL, action_id TEXT NOT NULL,
 PRIMARY KEY(account_id,challenge_id), UNIQUE(account_id,action_id),
 FOREIGN KEY(account_id,challenge_id) REFERENCES ai_recommendation_challenges(account_id,id),
 FOREIGN KEY(account_id,action_id) REFERENCES ai_recommendation_actions(account_id,id)
);
CREATE TRIGGER IF NOT EXISTS ai_challenge_submission_validate BEFORE INSERT ON ai_challenge_submissions
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ai_recommendation_challenges c JOIN ai_recommendation_actions a ON a.account_id=c.account_id AND a.recommendation_id=c.recommendation_id AND a.revision=c.revision WHERE c.account_id=NEW.account_id AND c.id=NEW.challenge_id AND a.id=NEW.action_id AND a.action='challenge' AND a.actor_id=c.challenged_by AND a.occurred_at=c.challenged_at) THEN RAISE(ABORT,'challenge action mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS ai_challenge_submission_no_update BEFORE UPDATE ON ai_challenge_submissions BEGIN SELECT RAISE(ABORT,'submission immutable'); END;
CREATE TRIGGER IF NOT EXISTS ai_action_challenge_gate BEFORE INSERT ON ai_recommendation_actions
WHEN NEW.action IN ('approve','execute')
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM ai_recommendation_publications p WHERE p.account_id=NEW.account_id AND p.recommendation_id=NEW.recommendation_id AND p.revision>NEW.revision) THEN RAISE(ABORT,'superseded revision') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM ai_recommendation_challenges c LEFT JOIN ai_challenge_resolutions r ON r.account_id=c.account_id AND r.challenge_id=c.id WHERE c.account_id=NEW.account_id AND c.recommendation_id=NEW.recommendation_id AND c.revision=NEW.revision AND (r.disposition IS NULL OR r.disposition<>'upheld')) THEN RAISE(ABORT,'blocking challenge') END;
 SELECT CASE WHEN NEW.action='execute' AND NOT EXISTS(SELECT 1 FROM ai_recommendation_actions a WHERE a.account_id=NEW.account_id AND a.recommendation_id=NEW.recommendation_id AND a.revision=NEW.revision AND a.action='approve' AND a.occurred_at<=NEW.occurred_at AND NOT EXISTS(SELECT 1 FROM ai_recommendation_challenges c JOIN ai_challenge_resolutions r ON r.account_id=c.account_id AND r.challenge_id=c.id WHERE c.account_id=a.account_id AND c.recommendation_id=a.recommendation_id AND c.revision=a.revision AND r.resolved_at>=a.occurred_at)) THEN RAISE(ABORT,'fresh approval required') END;
END;
-- These gates govern action records, not external vendor execution.
