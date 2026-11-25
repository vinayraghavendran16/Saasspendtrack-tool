-- Additive only: existing users, sessions, workspaces and trials remain unchanged.
CREATE TABLE IF NOT EXISTS oauth_identities (
  provider TEXT NOT NULL CHECK (provider IN ('google','microsoft')),
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  email TEXT NOT NULL REFERENCES users(email),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, issuer, subject)
);
CREATE INDEX IF NOT EXISTS idx_oauth_identities_email ON oauth_identities(email);
CREATE TABLE IF NOT EXISTS oauth_attempts (
  state_hash TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('google','microsoft')),
  browser_hash TEXT NOT NULL,
  nonce TEXT NOT NULL,
  pkce_verifier TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oauth_attempts_expiry ON oauth_attempts(expires_at);
