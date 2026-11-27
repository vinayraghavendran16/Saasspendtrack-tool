CREATE TABLE IF NOT EXISTS employee_subjects (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,id)
);
CREATE TABLE IF NOT EXISTS employee_source_status (
 account_id TEXT NOT NULL,
 subject_id TEXT NOT NULL,
 source_id TEXT NOT NULL,
 source_kind TEXT NOT NULL CHECK(source_kind IN ('hrms','idp')),
 pseudonymous_ref TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('active','inactive','unknown')),
 observed_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,source_id,pseudonymous_ref),
 FOREIGN KEY(account_id,subject_id) REFERENCES employee_subjects(account_id,id)
);
CREATE INDEX IF NOT EXISTS employee_status_subject ON employee_source_status(account_id,subject_id,source_kind);
