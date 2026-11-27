CREATE TABLE IF NOT EXISTS aop_scenarios (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 id TEXT NOT NULL,
 name TEXT NOT NULL,
 fiscal_start TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,id)
);
CREATE TABLE IF NOT EXISTS aop_scenario_versions (
 account_id TEXT NOT NULL,
 scenario_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 assumptions_json TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 created_by TEXT NOT NULL,
 PRIMARY KEY(account_id,scenario_id,revision),
 FOREIGN KEY(account_id,scenario_id) REFERENCES aop_scenarios(account_id,id)
);
CREATE TRIGGER IF NOT EXISTS aop_version_immutable_update BEFORE UPDATE ON aop_scenario_versions
BEGIN SELECT RAISE(ABORT,'scenario versions are immutable'); END;
CREATE TABLE IF NOT EXISTS aop_approvals (
 account_id TEXT NOT NULL,
 scenario_id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 approved_by TEXT NOT NULL,
 approved_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,scenario_id,revision),
 FOREIGN KEY(account_id,scenario_id,revision) REFERENCES aop_scenario_versions(account_id,scenario_id,revision)
);
