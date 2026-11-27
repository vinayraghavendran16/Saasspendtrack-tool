CREATE TABLE IF NOT EXISTS contract_ownership_mapping (
 account_id TEXT NOT NULL,
 contract_id TEXT NOT NULL,
 vendor_id TEXT NOT NULL CHECK(length(vendor_id) BETWEEN 1 AND 200 AND vendor_id<>'@workspace'),
 PRIMARY KEY(account_id,contract_id),
 FOREIGN KEY(account_id,contract_id) REFERENCES commercial_contracts(account_id,id)
);
