CREATE TABLE IF NOT EXISTS investment_decision_approvals (
 account_id TEXT NOT NULL, decision_id TEXT NOT NULL, revision INTEGER NOT NULL,
 selected_alternative_id TEXT NOT NULL, approved_by TEXT NOT NULL, approved_at INTEGER NOT NULL,
 rationale TEXT NOT NULL CHECK(length(trim(rationale)) BETWEEN 1 AND 4000),
 PRIMARY KEY(account_id,decision_id,revision),
 FOREIGN KEY(account_id,decision_id,revision) REFERENCES investment_decision_versions(account_id,decision_id,revision)
);
CREATE TRIGGER IF NOT EXISTS investment_approval_eligible BEFORE INSERT ON investment_decision_approvals
WHEN NOT EXISTS (
 SELECT 1 FROM investment_decision_versions v,json_each(v.evaluation_json,'$.alternatives') a
 WHERE v.account_id=NEW.account_id AND v.decision_id=NEW.decision_id AND v.revision=NEW.revision
 AND json_extract(a.value,'$.id')=NEW.selected_alternative_id AND json_extract(a.value,'$.eligible')=1
 AND v.revision=(SELECT MAX(revision) FROM investment_decision_versions WHERE account_id=NEW.account_id AND decision_id=NEW.decision_id)
)
BEGIN SELECT RAISE(ABORT,'ineligible_or_stale_decision'); END;
CREATE TRIGGER IF NOT EXISTS investment_approval_no_update BEFORE UPDATE ON investment_decision_approvals
BEGIN SELECT RAISE(ABORT,'approval_immutable'); END;
CREATE TRIGGER IF NOT EXISTS investment_approval_no_delete BEFORE DELETE ON investment_decision_approvals
BEGIN SELECT RAISE(ABORT,'approval_immutable'); END;
CREATE TRIGGER IF NOT EXISTS investment_outcome_requires_approval BEFORE INSERT ON investment_decision_outcomes
WHEN NOT EXISTS (SELECT 1 FROM investment_decision_approvals WHERE account_id=NEW.account_id AND decision_id=NEW.decision_id AND revision=NEW.revision AND selected_alternative_id=NEW.selected_alternative_id)
BEGIN SELECT RAISE(ABORT,'outcome_requires_approval'); END;
CREATE TRIGGER IF NOT EXISTS investment_outcome_no_delete BEFORE DELETE ON investment_decision_outcomes
BEGIN SELECT RAISE(ABORT,'outcome_immutable'); END;
