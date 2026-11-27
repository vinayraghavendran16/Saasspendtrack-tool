CREATE TABLE IF NOT EXISTS optimization_opportunities (
 account_id TEXT NOT NULL REFERENCES accounts(id), id TEXT NOT NULL,
 contract_id TEXT NOT NULL, opportunity_key TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('price','seat','sku','reseller','contract')),
 currency TEXT NOT NULL CHECK(length(currency)=3 AND currency=upper(currency)),
 annual_potential_minor INTEGER NOT NULL CHECK(annual_potential_minor>=0),
 status TEXT NOT NULL DEFAULT 'identified' CHECK(status IN ('identified','approved','contracted','realized','rejected')),
 evidence_ref TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,id), UNIQUE(account_id,opportunity_key),
 FOREIGN KEY(account_id,contract_id) REFERENCES commercial_contracts(account_id,id)
);
