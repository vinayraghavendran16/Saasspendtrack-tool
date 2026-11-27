-- Reconciliation snapshots reuse the reporting fact ledger; no second invoice ledger.
CREATE TABLE IF NOT EXISTS decision_financial_reviews (
 account_id TEXT NOT NULL, decision_id TEXT NOT NULL, revision INTEGER NOT NULL,
 contract_id TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL,
 selected_alternative_id TEXT NOT NULL, result_json TEXT NOT NULL CHECK(json_valid(result_json)),
 evidence_json TEXT NOT NULL CHECK(json_valid(evidence_json)),
 reviewed_by TEXT NOT NULL, reviewed_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,decision_id,revision),
 FOREIGN KEY(account_id,decision_id,revision) REFERENCES investment_decision_approvals(account_id,decision_id,revision),
 FOREIGN KEY(account_id,contract_id) REFERENCES commercial_contracts(account_id,id),
 CHECK(period_end>=period_start)
);
CREATE TRIGGER IF NOT EXISTS financial_review_selected_approval BEFORE INSERT ON decision_financial_reviews
WHEN NOT EXISTS (SELECT 1 FROM investment_decision_approvals a WHERE a.account_id=NEW.account_id AND a.decision_id=NEW.decision_id AND a.revision=NEW.revision AND a.selected_alternative_id=NEW.selected_alternative_id)
BEGIN SELECT RAISE(ABORT,'financial_review_requires_matching_approval'); END;
CREATE TRIGGER IF NOT EXISTS financial_review_no_update BEFORE UPDATE ON decision_financial_reviews
BEGIN SELECT RAISE(ABORT,'financial_review_immutable'); END;
CREATE TRIGGER IF NOT EXISTS financial_review_no_delete BEFORE DELETE ON decision_financial_reviews
BEGIN SELECT RAISE(ABORT,'financial_review_immutable'); END;
