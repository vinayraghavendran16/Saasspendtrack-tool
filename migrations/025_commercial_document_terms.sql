CREATE TABLE IF NOT EXISTS commercial_documents (
 account_id TEXT NOT NULL,id TEXT NOT NULL,contract_id TEXT NOT NULL,parent_id TEXT,
 kind TEXT NOT NULL CHECK(kind IN ('master','order','amendment','renewal','credit')),
 reference TEXT NOT NULL,effective_date TEXT NOT NULL,source_ref TEXT NOT NULL,
 verification TEXT NOT NULL CHECK(verification IN ('unverified','verified')),
 PRIMARY KEY(account_id,id),UNIQUE(account_id,contract_id,id),
 FOREIGN KEY(account_id,contract_id) REFERENCES commercial_contracts(account_id,id),
 FOREIGN KEY(account_id,contract_id,parent_id) REFERENCES commercial_documents(account_id,contract_id,id),
 CHECK(parent_id IS NULL OR parent_id<>id)
);
CREATE TABLE IF NOT EXISTS commercial_document_clauses (
 account_id TEXT NOT NULL,document_id TEXT NOT NULL,id TEXT NOT NULL,
 clause_key TEXT NOT NULL,value_json TEXT NOT NULL,page_reference TEXT,
 verification TEXT NOT NULL CHECK(verification IN ('unverified','verified')),
 PRIMARY KEY(account_id,document_id,id),
 FOREIGN KEY(account_id,document_id) REFERENCES commercial_documents(account_id,id)
);
CREATE TABLE IF NOT EXISTS commercial_document_line_changes (
 account_id TEXT NOT NULL,document_id TEXT NOT NULL,id TEXT NOT NULL,sku_id TEXT NOT NULL,
 quantity_delta INTEGER NOT NULL,unit_price_minor INTEGER CHECK(unit_price_minor>=0),
 currency TEXT NOT NULL CHECK(length(currency)=3 AND currency=upper(currency)),
 billing_period TEXT NOT NULL CHECK(billing_period IN ('monthly','annual','one_time','usage','custom')),
 PRIMARY KEY(account_id,document_id,id),
 FOREIGN KEY(account_id,document_id) REFERENCES commercial_documents(account_id,id),
 FOREIGN KEY(account_id,sku_id) REFERENCES commercial_skus(account_id,id)
);
