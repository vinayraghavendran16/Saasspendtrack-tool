CREATE TABLE IF NOT EXISTS commercial_cost_facts (
 account_id TEXT NOT NULL,id TEXT NOT NULL,contract_id TEXT NOT NULL,sku_id TEXT,
 basis TEXT NOT NULL CHECK(basis IN ('commitment','invoice','payment','expense_allocation')),
 component TEXT NOT NULL CHECK(component IN ('seat','platform','consumption','service','maintenance','implementation','support','tax','discount','other')),
 currency TEXT NOT NULL CHECK(length(currency)=3 AND currency=upper(currency)),
 amount_minor INTEGER NOT NULL,period_start TEXT NOT NULL,period_end TEXT NOT NULL,
 source_ref TEXT NOT NULL,source_line_key TEXT NOT NULL,
 evidence TEXT NOT NULL CHECK(evidence IN ('assumption','quoted','verified')),
 PRIMARY KEY(account_id,id),UNIQUE(account_id,basis,source_ref,source_line_key),
 FOREIGN KEY(account_id,contract_id) REFERENCES commercial_contracts(account_id,id),
 FOREIGN KEY(account_id,sku_id) REFERENCES commercial_skus(account_id,id),
 CHECK(period_end>=period_start)
);
