CREATE TABLE IF NOT EXISTS employee_app_assignments (
 account_id TEXT NOT NULL, subject_id TEXT NOT NULL, sku_id TEXT NOT NULL, source_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('assigned','removed','unknown')),
 observed_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,subject_id,sku_id,source_id),
 FOREIGN KEY(account_id,subject_id) REFERENCES employee_subjects(account_id,id),
 FOREIGN KEY(account_id,sku_id) REFERENCES commercial_skus(account_id,id),
 FOREIGN KEY(account_id,source_id) REFERENCES identity_connections(account_id,id)
);
