-- Tenant-local decision memory. No cross-customer benchmarks or model training.
CREATE TABLE IF NOT EXISTS investment_decisions (
 account_id TEXT NOT NULL REFERENCES accounts(id), id TEXT NOT NULL,
 scope_key TEXT NOT NULL, objective TEXT NOT NULL CHECK(objective IN ('efficiency','growth','risk')),
 created_by TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,id)
);
CREATE TABLE IF NOT EXISTS investment_decision_versions (
 account_id TEXT NOT NULL, decision_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0),
 inputs_json TEXT NOT NULL CHECK(json_valid(inputs_json)), evaluation_json TEXT NOT NULL CHECK(json_valid(evaluation_json)),
 created_by TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,decision_id,revision),
 FOREIGN KEY(account_id,decision_id) REFERENCES investment_decisions(account_id,id)
);
CREATE TABLE IF NOT EXISTS investment_decision_outcomes (
 account_id TEXT NOT NULL, decision_id TEXT NOT NULL, revision INTEGER NOT NULL, id TEXT NOT NULL,
 selected_alternative_id TEXT NOT NULL, outcome_json TEXT NOT NULL CHECK(json_valid(outcome_json)),
 evidence_ref TEXT NOT NULL, recorded_by TEXT NOT NULL, recorded_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,decision_id,revision,id),
 FOREIGN KEY(account_id,decision_id,revision) REFERENCES investment_decision_versions(account_id,decision_id,revision)
);
CREATE TRIGGER IF NOT EXISTS decision_version_no_update BEFORE UPDATE ON investment_decision_versions
BEGIN SELECT RAISE(ABORT,'decision_version_immutable'); END;
CREATE TRIGGER IF NOT EXISTS decision_outcome_no_update BEFORE UPDATE ON investment_decision_outcomes
BEGIN SELECT RAISE(ABORT,'decision_outcome_immutable'); END;
