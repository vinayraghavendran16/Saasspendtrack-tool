-- No API writes until atomic allocation and attestation validation are implemented.
CREATE TABLE IF NOT EXISTS decision_financial_attestations (
 account_id TEXT NOT NULL, decision_id TEXT NOT NULL, revision INTEGER NOT NULL,
 reviewer_id TEXT NOT NULL CHECK(length(trim(reviewer_id))>0),
 evidence_digest TEXT NOT NULL CHECK(length(evidence_digest)=64 AND evidence_digest NOT GLOB '*[^0-9a-f]*'),
 baseline_approved INTEGER NOT NULL CHECK(baseline_approved=1),
 period_complete INTEGER NOT NULL CHECK(period_complete=1),
 attribution_verified INTEGER NOT NULL CHECK(attribution_verified=1),
 attested_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,decision_id,revision),
 FOREIGN KEY(account_id,decision_id,revision) REFERENCES decision_financial_reviews(account_id,decision_id,revision)
);
CREATE TABLE IF NOT EXISTS decision_financial_fact_allocations (
 account_id TEXT NOT NULL, fact_id TEXT NOT NULL, decision_id TEXT NOT NULL, revision INTEGER NOT NULL,
 PRIMARY KEY(account_id,fact_id),
 FOREIGN KEY(account_id,fact_id) REFERENCES reporting_financial_facts(account_id,id),
 FOREIGN KEY(account_id,decision_id,revision) REFERENCES decision_financial_attestations(account_id,decision_id,revision)
);
CREATE TRIGGER IF NOT EXISTS financial_allocation_scope BEFORE INSERT ON decision_financial_fact_allocations
WHEN NOT EXISTS (
 SELECT 1 FROM decision_financial_reviews r JOIN json_each(r.evidence_json) e
 JOIN reporting_financial_facts f ON f.account_id=r.account_id AND f.id=NEW.fact_id
 WHERE r.account_id=NEW.account_id AND r.decision_id=NEW.decision_id AND r.revision=NEW.revision
 AND json_extract(e.value,'$.id')=f.id AND f.contract_id=r.contract_id
 AND f.effective_date BETWEEN r.period_start AND r.period_end
)
BEGIN SELECT RAISE(ABORT,'financial_allocation_scope_mismatch'); END;
CREATE TRIGGER IF NOT EXISTS financial_attestation_no_update BEFORE UPDATE ON decision_financial_attestations
BEGIN SELECT RAISE(ABORT,'financial_attestation_immutable'); END;
CREATE TRIGGER IF NOT EXISTS financial_attestation_no_delete BEFORE DELETE ON decision_financial_attestations
BEGIN SELECT RAISE(ABORT,'financial_attestation_immutable'); END;
CREATE TRIGGER IF NOT EXISTS financial_allocation_no_update BEFORE UPDATE ON decision_financial_fact_allocations
BEGIN SELECT RAISE(ABORT,'financial_allocation_immutable'); END;
CREATE TRIGGER IF NOT EXISTS financial_allocation_no_delete BEFORE DELETE ON decision_financial_fact_allocations
BEGIN SELECT RAISE(ABORT,'financial_allocation_immutable'); END;

-- Reject snapshots that omit newly recorded in-period ledger facts.
CREATE TRIGGER IF NOT EXISTS financial_attestation_complete_snapshot BEFORE INSERT ON decision_financial_attestations
WHEN EXISTS (
 SELECT 1 FROM decision_financial_reviews r JOIN reporting_financial_facts f
 ON f.account_id=r.account_id AND f.contract_id=r.contract_id
 AND f.effective_date BETWEEN r.period_start AND r.period_end AND f.kind IN ('invoice','credit')
 WHERE r.account_id=NEW.account_id AND r.decision_id=NEW.decision_id AND r.revision=NEW.revision
 AND NOT EXISTS (SELECT 1 FROM json_each(r.evidence_json) e WHERE json_extract(e.value,'$.id')=f.id)
)
BEGIN SELECT RAISE(ABORT,'financial_snapshot_incomplete'); END;
