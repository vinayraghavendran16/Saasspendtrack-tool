CREATE TABLE IF NOT EXISTS financial_departments (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 id TEXT NOT NULL CHECK(length(trim(id)) BETWEEN 1 AND 128),
 label TEXT NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 240),
 status TEXT NOT NULL CHECK(status IN ('active','retired')),
 created_at INTEGER NOT NULL CHECK(created_at>0),
 PRIMARY KEY(account_id,id)
);
CREATE TABLE IF NOT EXISTS financial_department_sources (
 account_id TEXT NOT NULL,
 source_namespace TEXT NOT NULL CHECK(length(trim(source_namespace)) BETWEEN 1 AND 128),
 source_department_id TEXT NOT NULL CHECK(length(trim(source_department_id)) BETWEEN 1 AND 256),
 department_id TEXT NOT NULL,
 reviewed_by TEXT NOT NULL CHECK(length(trim(reviewed_by))>0),
 reviewed_at INTEGER NOT NULL CHECK(reviewed_at>0),
 PRIMARY KEY(account_id,source_namespace,source_department_id),
 FOREIGN KEY(account_id,department_id) REFERENCES financial_departments(account_id,id)
);
CREATE TRIGGER IF NOT EXISTS financial_department_identity_immutable
BEFORE UPDATE OF account_id,id ON financial_departments
BEGIN SELECT RAISE(ABORT,'department identity immutable'); END;
CREATE TRIGGER IF NOT EXISTS financial_department_source_active
BEFORE INSERT ON financial_department_sources
WHEN NOT EXISTS(SELECT 1 FROM financial_departments d WHERE d.account_id=NEW.account_id AND d.id=NEW.department_id AND d.status='active')
BEGIN SELECT RAISE(ABORT,'active department required'); END;
CREATE TRIGGER IF NOT EXISTS financial_department_source_immutable
BEFORE UPDATE ON financial_department_sources
BEGIN SELECT RAISE(ABORT,'source mapping immutable'); END;
