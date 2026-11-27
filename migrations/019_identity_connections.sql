CREATE TABLE IF NOT EXISTS identity_connections (
 account_id TEXT NOT NULL REFERENCES accounts(id), id TEXT NOT NULL,
 provider TEXT NOT NULL CHECK(provider IN ('entra','okta','google','hrms')),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 last_success_at INTEGER, last_attempt_at INTEGER,
 sync_state TEXT NOT NULL DEFAULT 'never' CHECK(sync_state IN ('never','running','success','failed')),
 PRIMARY KEY(account_id,id)
);
