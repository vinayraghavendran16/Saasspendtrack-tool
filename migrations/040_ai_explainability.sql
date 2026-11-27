CREATE TABLE IF NOT EXISTS ai_recommendation_revisions (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 recommendation_id TEXT NOT NULL CHECK(length(recommendation_id) BETWEEN 1 AND 128),
 revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision>0),
 module TEXT NOT NULL CHECK(length(module) BETWEEN 1 AND 80),
 rationale TEXT NOT NULL CHECK(length(trim(rationale)) BETWEEN 1 AND 8000),
 assumptions_json TEXT NOT NULL CHECK(json_valid(assumptions_json) AND json_type(assumptions_json)='array' AND length(assumptions_json)<=16000),
 limitations_json TEXT NOT NULL CHECK(json_valid(limitations_json) AND json_type(limitations_json)='array' AND length(limitations_json)<=16000),
 model_version TEXT NOT NULL CHECK(length(model_version) BETWEEN 1 AND 256),
 created_at INTEGER NOT NULL CHECK(typeof(created_at)='integer' AND created_at>0),
 PRIMARY KEY(account_id,recommendation_id,revision)
);
CREATE TRIGGER IF NOT EXISTS ai_recommendation_revision_sequence BEFORE INSERT ON ai_recommendation_revisions
WHEN NEW.revision<>COALESCE((SELECT MAX(revision) FROM ai_recommendation_revisions WHERE account_id=NEW.account_id AND recommendation_id=NEW.recommendation_id),0)+1
BEGIN SELECT RAISE(ABORT,'recommendation revision conflict'); END;
CREATE TABLE IF NOT EXISTS ai_recommendation_challenges (
 account_id TEXT NOT NULL,
 id TEXT NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
 recommendation_id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('source_accuracy','interpretation','assumption','calculation','completeness','recommendation')),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 4000),
 challenged_by TEXT NOT NULL CHECK(length(trim(challenged_by)) BETWEEN 1 AND 256),
 challenged_at INTEGER NOT NULL CHECK(typeof(challenged_at)='integer' AND challenged_at>0),
 PRIMARY KEY(account_id,id),
 FOREIGN KEY(account_id,recommendation_id,revision) REFERENCES ai_recommendation_revisions(account_id,recommendation_id,revision)
);
CREATE INDEX IF NOT EXISTS ai_challenges_revision ON ai_recommendation_challenges(account_id,recommendation_id,revision);
CREATE TRIGGER IF NOT EXISTS ai_recommendation_no_update BEFORE UPDATE ON ai_recommendation_revisions
BEGIN SELECT RAISE(ABORT,'recommendation revision immutable'); END;
CREATE TRIGGER IF NOT EXISTS ai_challenge_no_update BEFORE UPDATE ON ai_recommendation_challenges
BEGIN SELECT RAISE(ABORT,'challenge immutable'); END;
-- Retention and erasure policy must be established before activation.
