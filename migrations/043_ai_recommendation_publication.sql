CREATE TABLE IF NOT EXISTS ai_recommendation_publications (
 account_id TEXT NOT NULL,
 recommendation_id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 contract_id TEXT,
 audit_event_id TEXT NOT NULL,
 published_at INTEGER NOT NULL CHECK(typeof(published_at)='integer' AND published_at>0),
 PRIMARY KEY(account_id,recommendation_id,revision),
 UNIQUE(account_id,audit_event_id),
 FOREIGN KEY(account_id,recommendation_id,revision) REFERENCES ai_recommendation_revisions(account_id,recommendation_id,revision),
 FOREIGN KEY(account_id,contract_id) REFERENCES commercial_contracts(account_id,id),
 FOREIGN KEY(account_id,audit_event_id) REFERENCES platform_audit_events(account_id,id)
);
CREATE TRIGGER IF NOT EXISTS ai_publication_validate BEFORE INSERT ON ai_recommendation_publications
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM platform_audit_events a WHERE a.account_id=NEW.account_id AND a.id=NEW.audit_event_id AND a.entity_type='ai_recommendation' AND a.entity_id=NEW.recommendation_id AND a.action='generate' AND a.outcome='proposed') THEN RAISE(ABORT,'generation audit mismatch') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ai_recommendation_evidence e WHERE e.account_id=NEW.account_id AND e.recommendation_id=NEW.recommendation_id AND e.revision=NEW.revision) THEN RAISE(ABORT,'evidence required') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM ai_recommendation_evidence e WHERE e.account_id=NEW.account_id AND e.recommendation_id=NEW.recommendation_id AND e.revision=NEW.revision AND NOT EXISTS(SELECT 1 FROM ai_artifact_versions v JOIN ai_artifacts a ON a.account_id=v.account_id AND a.id=v.artifact_id WHERE v.account_id=e.account_id AND v.artifact_id=e.artifact_id AND v.digest=e.artifact_digest AND a.status='active' AND (NEW.contract_id IS NULL OR a.contract_id=NEW.contract_id))) THEN RAISE(ABORT,'artifact unavailable or contract mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS ai_publication_no_update BEFORE UPDATE ON ai_recommendation_publications BEGIN SELECT RAISE(ABORT,'publication immutable'); END;
CREATE TRIGGER IF NOT EXISTS ai_publication_evidence_sealed BEFORE INSERT ON ai_recommendation_evidence
WHEN EXISTS(SELECT 1 FROM ai_recommendation_publications p WHERE p.account_id=NEW.account_id AND p.recommendation_id=NEW.recommendation_id AND p.revision=NEW.revision)
BEGIN SELECT RAISE(ABORT,'published evidence sealed'); END;
-- Publication is not approval or execution. Text verification remains a service-layer gate.
