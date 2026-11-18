-- SaaS Spend Track — trial gating / auth schema (Cloudflare D1, SQLite)
-- Apply with:  wrangler d1 execute sst-trial --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  email          TEXT PRIMARY KEY,      -- lowercased
  created_at     INTEGER NOT NULL,      -- epoch ms; trial start
  trial_ends_at  INTEGER NOT NULL,      -- created_at + 7 days
  status         TEXT NOT NULL DEFAULT 'trial',  -- 'trial' | 'active' | 'expired'
  plan           TEXT,                  -- e.g. 'annual' once paid
  paid_at        INTEGER,
  rp_payment_id  TEXT,                  -- Razorpay payment id (idempotency)
  amount_paid    INTEGER,               -- smallest unit (paise / cents) as Razorpay reports
  currency       TEXT,                  -- 'INR' | 'USD'
  last_login_at  INTEGER
);

-- Single-use magic-link tokens (we store only a hash)
CREATE TABLE IF NOT EXISTS login_tokens (
  token_hash   TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  expires_at   INTEGER NOT NULL,
  used         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_login_tokens_email ON login_tokens(email);

-- Server-side sessions (cookie holds the id)
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);

-- Idempotency log for cadence + transactional emails
CREATE TABLE IF NOT EXISTS email_log (
  email    TEXT NOT NULL,
  kind     TEXT NOT NULL,   -- 'welcome','day3','day6','day7','expired','paid'
  sent_at  INTEGER NOT NULL,
  PRIMARY KEY (email, kind)
);
