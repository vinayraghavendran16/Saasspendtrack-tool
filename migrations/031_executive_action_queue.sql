-- Workspace-local review tasks; no automatic execution or approval.
CREATE TABLE IF NOT EXISTS executive_actions (
 account_id TEXT NOT NULL REFERENCES accounts(id), id TEXT NOT NULL,
 decision_id TEXT NOT NULL, revision INTEGER NOT NULL, alternative_id TEXT NOT NULL,
 owner_role TEXT NOT NULL CHECK(owner_role IN ('finance','it','procurement','revops','leadership')),
 risk TEXT NOT NULL CHECK(risk IN ('critical','high','medium','low')),
 evidence TEXT NOT NULL CHECK(evidence IN ('verified','quoted','assumed','unknown')),
 deadline TEXT, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','dismissed','reviewed')),
 created_by TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,id),
 UNIQUE(account_id,decision_id,revision,alternative_id,owner_role),
 FOREIGN KEY(account_id,decision_id,revision) REFERENCES investment_decision_versions(account_id,decision_id,revision)
);
CREATE INDEX IF NOT EXISTS executive_actions_queue ON executive_actions(account_id,status,owner_role);
