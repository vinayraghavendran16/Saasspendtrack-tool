CREATE TABLE IF NOT EXISTS department_allocation_versions (
 account_id TEXT NOT NULL,
 fact_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision>0),
 currency TEXT NOT NULL,
 fact_kind TEXT NOT NULL CHECK(fact_kind IN ('invoice','credit')),
 fact_amount_minor INTEGER NOT NULL CHECK(typeof(fact_amount_minor)='integer' AND fact_amount_minor>=0),
 fact_effective_date TEXT NOT NULL,
 weights_json TEXT NOT NULL CHECK(json_valid(weights_json) AND json_type(weights_json)='array' AND json_array_length(weights_json)<=500),
 rationale TEXT NOT NULL CHECK(length(trim(rationale)) BETWEEN 1 AND 1000),
 reviewed_by TEXT NOT NULL CHECK(length(trim(reviewed_by))>0),
 reviewed_at INTEGER NOT NULL CHECK(reviewed_at>0),
 PRIMARY KEY(account_id,fact_id,revision),
 FOREIGN KEY(account_id,fact_id) REFERENCES reporting_financial_facts(account_id,id)
);
CREATE TRIGGER IF NOT EXISTS department_allocation_validate
BEFORE INSERT ON department_allocation_versions
BEGIN
 SELECT CASE WHEN NEW.revision<>COALESCE((SELECT MAX(revision) FROM department_allocation_versions WHERE account_id=NEW.account_id AND fact_id=NEW.fact_id),0)+1 THEN RAISE(ABORT,'revision conflict') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM reporting_financial_facts f WHERE f.account_id=NEW.account_id AND f.id=NEW.fact_id AND f.kind=NEW.fact_kind AND f.currency=NEW.currency AND f.amount_minor=NEW.fact_amount_minor AND f.effective_date=NEW.fact_effective_date) THEN RAISE(ABORT,'ledger snapshot mismatch') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.weights_json) w WHERE json_type(w.value,'$.departmentId') IS NOT 'text' OR json_type(w.value,'$.basisPoints') IS NOT 'integer' OR json_extract(w.value,'$.basisPoints') NOT BETWEEN 1 AND 10000 OR NOT EXISTS(SELECT 1 FROM financial_departments d WHERE d.account_id=NEW.account_id AND d.id=json_extract(w.value,'$.departmentId') AND d.status='active')) THEN RAISE(ABORT,'invalid department weight') END;
 SELECT CASE WHEN (SELECT COUNT(*) FROM json_each(NEW.weights_json))<>(SELECT COUNT(DISTINCT json_extract(value,'$.departmentId')) FROM json_each(NEW.weights_json)) THEN RAISE(ABORT,'duplicate department') END;
 SELECT CASE WHEN (SELECT COALESCE(SUM(json_extract(value,'$.basisPoints')),0) FROM json_each(NEW.weights_json))>10000 THEN RAISE(ABORT,'overallocated') END;
END;
CREATE TRIGGER IF NOT EXISTS department_allocation_immutable_update BEFORE UPDATE ON department_allocation_versions
BEGIN SELECT RAISE(ABORT,'allocation revision immutable'); END;
CREATE TRIGGER IF NOT EXISTS department_allocation_immutable_delete BEFORE DELETE ON department_allocation_versions
BEGIN SELECT RAISE(ABORT,'allocation revision immutable'); END;
