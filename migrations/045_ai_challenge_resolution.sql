CREATE TABLE IF NOT EXISTS ai_challenge_resolutions (
 account_id TEXT NOT NULL,
 challenge_id TEXT NOT NULL,
 disposition TEXT NOT NULL CHECK(disposition IN ('upheld','revised','withdrawn','insufficient_evidence')),
 replacement_revision INTEGER,
 rationale TEXT NOT NULL CHECK(length(trim(rationale)) BETWEEN 1 AND 4000),
 resolved_by TEXT NOT NULL CHECK(length(trim(resolved_by)) BETWEEN 1 AND 256),
 resolved_at INTEGER NOT NULL CHECK(typeof(resolved_at)='integer' AND resolved_at>0),
 audit_event_id TEXT NOT NULL,
 PRIMARY KEY(account_id,challenge_id),
 UNIQUE(account_id,audit_event_id),
 FOREIGN KEY(account_id,challenge_id) REFERENCES ai_recommendation_challenges(account_id,id),
 FOREIGN KEY(account_id,audit_event_id) REFERENCES platform_audit_events(account_id,id),
 CHECK((disposition='revised' AND replacement_revision IS NOT NULL) OR (disposition<>'revised' AND replacement_revision IS NULL))
);
CREATE TRIGGER IF NOT EXISTS ai_challenge_resolution_validate BEFORE INSERT ON ai_challenge_resolutions
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ai_recommendation_challenges c JOIN ai_recommendation_publications p ON p.account_id=c.account_id AND p.recommendation_id=c.recommendation_id AND p.revision=c.revision JOIN platform_audit_events a ON a.account_id=c.account_id AND a.id=NEW.audit_event_id WHERE c.account_id=NEW.account_id AND c.id=NEW.challenge_id AND NEW.resolved_at>=c.challenged_at AND a.entity_type='ai_challenge' AND a.entity_id=c.id AND a.action='resolve' AND a.outcome='committed' AND a.actor_id=NEW.resolved_by AND a.occurred_at=NEW.resolved_at) THEN RAISE(ABORT,'challenge resolution audit mismatch') END;
 SELECT CASE WHEN NEW.disposition='revised' AND NOT EXISTS(SELECT 1 FROM ai_recommendation_challenges c JOIN ai_recommendation_publications p ON p.account_id=c.account_id AND p.recommendation_id=c.recommendation_id AND p.revision=NEW.replacement_revision WHERE c.account_id=NEW.account_id AND c.id=NEW.challenge_id AND p.revision>c.revision) THEN RAISE(ABORT,'replacement must be a later published revision') END;
END;
CREATE TRIGGER IF NOT EXISTS ai_challenge_resolution_no_update BEFORE UPDATE ON ai_challenge_resolutions BEGIN SELECT RAISE(ABORT,'resolution immutable'); END;
-- Insufficient evidence remains a blocking disposition; approval guards must enforce this.
