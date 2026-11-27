CREATE TABLE IF NOT EXISTS ai_recommendation_evidence (
 account_id TEXT NOT NULL,
 recommendation_id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 id TEXT NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
 artifact_type TEXT NOT NULL CHECK(artifact_type IN ('msa','order_form','sow','amendment','invoice','spreadsheet','usage','report','email','integration','decision','other')),
 artifact_id TEXT NOT NULL CHECK(length(artifact_id) BETWEEN 1 AND 256),
 artifact_digest TEXT NOT NULL CHECK(length(artifact_digest)=64 AND artifact_digest NOT GLOB '*[^0-9a-f]*'),
 locator_json TEXT NOT NULL CHECK(json_valid(locator_json) AND json_type(locator_json)='object' AND length(locator_json)<=4096),
 evidence_kind TEXT NOT NULL CHECK(evidence_kind IN ('direct','derived','inference')),
 PRIMARY KEY(account_id,recommendation_id,revision,id),
 FOREIGN KEY(account_id,recommendation_id,revision) REFERENCES ai_recommendation_revisions(account_id,recommendation_id,revision)
);
CREATE TABLE IF NOT EXISTS ai_recommendation_actions (
 account_id TEXT NOT NULL,
 id TEXT NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
 recommendation_id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 contract_id TEXT,
 action TEXT NOT NULL CHECK(action IN ('view_rationale','view_evidence','challenge','reassess','accept','reject','defer','approve','execute','record_outcome')),
 actor_id TEXT NOT NULL CHECK(length(trim(actor_id)) BETWEEN 1 AND 256),
 occurred_at INTEGER NOT NULL CHECK(typeof(occurred_at)='integer' AND occurred_at>0),
 audit_event_id TEXT NOT NULL,
 PRIMARY KEY(account_id,id),
 UNIQUE(account_id,audit_event_id),
 FOREIGN KEY(account_id,recommendation_id,revision) REFERENCES ai_recommendation_revisions(account_id,recommendation_id,revision),
 FOREIGN KEY(account_id,contract_id) REFERENCES commercial_contracts(account_id,id),
 FOREIGN KEY(account_id,audit_event_id) REFERENCES platform_audit_events(account_id,id)
);
CREATE INDEX IF NOT EXISTS ai_actions_contract ON ai_recommendation_actions(account_id,contract_id,occurred_at);
CREATE TRIGGER IF NOT EXISTS ai_evidence_no_update BEFORE UPDATE ON ai_recommendation_evidence
BEGIN SELECT RAISE(ABORT,'evidence immutable'); END;
CREATE TRIGGER IF NOT EXISTS ai_action_no_update BEFORE UPDATE ON ai_recommendation_actions
BEGIN SELECT RAISE(ABORT,'action immutable'); END;
-- Evidence locators are unverified until resolved against an authorized artifact.
-- Retention and deletion controls are required before activation.
