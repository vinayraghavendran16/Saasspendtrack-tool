CREATE TABLE IF NOT EXISTS reporting_financial_facts (
 account_id TEXT NOT NULL REFERENCES accounts(id), id TEXT NOT NULL,
 source_id TEXT NOT NULL, source_record_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('invoice','credit','budget')),
 effective_date TEXT NOT NULL, currency TEXT NOT NULL CHECK(length(currency)=3 AND currency=upper(currency)),
 amount_minor INTEGER NOT NULL, contract_id TEXT,
 recorded_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,id),
 UNIQUE(account_id,source_id,source_record_id),
 FOREIGN KEY(account_id,contract_id) REFERENCES commercial_contracts(account_id,id)
);
CREATE INDEX IF NOT EXISTS reporting_facts_period ON reporting_financial_facts(account_id,effective_date,currency,kind);
