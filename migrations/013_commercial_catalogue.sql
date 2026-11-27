-- Additive commercial catalogue; legacy snapshots remain authoritative until reconciled.
CREATE TABLE IF NOT EXISTS commercial_parties (
 account_id TEXT NOT NULL REFERENCES accounts(id), id TEXT NOT NULL,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 240),
 PRIMARY KEY(account_id,id)
);
CREATE TABLE IF NOT EXISTS commercial_party_roles (
 account_id TEXT NOT NULL, party_id TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('supplier','reseller','publisher')),
 PRIMARY KEY(account_id,party_id,role),
 FOREIGN KEY(account_id,party_id) REFERENCES commercial_parties(account_id,id)
);
CREATE TABLE IF NOT EXISTS commercial_products (
 account_id TEXT NOT NULL, id TEXT NOT NULL, publisher_id TEXT NOT NULL,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 240),
 PRIMARY KEY(account_id,id),
 FOREIGN KEY(account_id,publisher_id) REFERENCES commercial_parties(account_id,id)
);
CREATE TABLE IF NOT EXISTS commercial_skus (
 account_id TEXT NOT NULL,id TEXT NOT NULL,product_id TEXT NOT NULL,
 name TEXT NOT NULL,external_code TEXT,
 unit TEXT NOT NULL CHECK(unit IN ('seat','credit','consumption','fixed')),
 PRIMARY KEY(account_id,id),
 FOREIGN KEY(account_id,product_id) REFERENCES commercial_products(account_id,id)
);
CREATE TABLE IF NOT EXISTS commercial_contracts (
 account_id TEXT NOT NULL,id TEXT NOT NULL,supplier_id TEXT NOT NULL,reseller_id TEXT,
 reference TEXT,start_date TEXT,end_date TEXT,notice_date TEXT,
 PRIMARY KEY(account_id,id),
 FOREIGN KEY(account_id,supplier_id) REFERENCES commercial_parties(account_id,id),
 FOREIGN KEY(account_id,reseller_id) REFERENCES commercial_parties(account_id,id)
);
CREATE TABLE IF NOT EXISTS commercial_purchase_lines (
 account_id TEXT NOT NULL,id TEXT NOT NULL,contract_id TEXT NOT NULL,sku_id TEXT NOT NULL,
 reseller_id TEXT,quantity_decimal TEXT NOT NULL,unit_price_minor INTEGER NOT NULL CHECK(unit_price_minor>=0),
 currency TEXT NOT NULL CHECK(length(currency)=3 AND currency=upper(currency)),
 billing_period TEXT NOT NULL CHECK(billing_period IN ('monthly','annual','one_time','usage','custom')),
 legacy_subscription_id TEXT,
 PRIMARY KEY(account_id,id),
 FOREIGN KEY(account_id,contract_id) REFERENCES commercial_contracts(account_id,id),
 FOREIGN KEY(account_id,sku_id) REFERENCES commercial_skus(account_id,id),
 FOREIGN KEY(account_id,reseller_id) REFERENCES commercial_parties(account_id,id)
);
CREATE INDEX IF NOT EXISTS commercial_lines_contract ON commercial_purchase_lines(account_id,contract_id);
CREATE INDEX IF NOT EXISTS commercial_lines_sku ON commercial_purchase_lines(account_id,sku_id);
