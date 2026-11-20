-- SaaS Spend Track - trial gating / auth schema (Cloudflare D1, SQLite)
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
  kind     TEXT NOT NULL,   -- 'welcome','day2','day4','day6','expired','paid'
  sent_at  INTEGER NOT NULL,
  PRIMARY KEY (email, kind)
);

-- Per-account application data (subscriptions, invoices, settings, etc.).
-- Replaces browser localStorage so data follows the user across devices.
CREATE TABLE IF NOT EXISTS app_data (
  email       TEXT PRIMARY KEY,
  data        TEXT,           -- JSON blob of the app state
  updated_at  INTEGER
);

-- Fixed-window rate-limit counters (auth requests, AI calls, proxy calls).
CREATE TABLE IF NOT EXISTS rate_limits (
  rl_key       TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_rp_payment ON users(rp_payment_id);

-- RB2B identified website visitors, pushed in from RB2B (via Make/Zapier or a
-- direct webhook) to /api/rb2b/ingest and shown in the admin command centre.
CREATE TABLE IF NOT EXISTS rb2b_visitors (
  id             TEXT PRIMARY KEY,   -- dedup key: linkedin_url | email | hash
  name           TEXT,
  title          TEXT,
  company        TEXT,
  company_domain TEXT,
  linkedin_url   TEXT,
  email          TEXT,
  location       TEXT,
  last_page      TEXT,
  page_count     INTEGER,
  identified_at  INTEGER,            -- when RB2B saw them (epoch ms)
  raw            TEXT,               -- raw payload (capped)
  created_at     INTEGER NOT NULL    -- when we ingested it
);
CREATE INDEX IF NOT EXISTS idx_rb2b_identified ON rb2b_visitors(identified_at);
-- ===================================================================
-- Multi-user accounts (Phase 1: tables ship dark, not yet wired).
-- An account is a shared workspace. One account per member: an email
-- belongs to exactly one account. Roles: 'owner' | 'admin' | 'member'.
-- Flat billing per account regardless of seat count; soft cap 50 members.
-- ===================================================================
CREATE TABLE IF NOT EXISTS accounts (
  id           TEXT PRIMARY KEY,        -- uuid
  name         TEXT,                    -- display/company name
  owner_email  TEXT NOT NULL,           -- founding owner (lowercased)
  plan         TEXT,                    -- carried from owner billing
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accounts_owner ON accounts(owner_email);

-- One row per email (email PK = one account per member).
CREATE TABLE IF NOT EXISTS memberships (
  email       TEXT PRIMARY KEY,         -- lowercased
  account_id  TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'admin' | 'member'
  status      TEXT NOT NULL DEFAULT 'active',  -- 'invited' | 'active' | 'suspended'
  invited_by  TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memberships_account ON memberships(account_id);

-- Single-use, hashed invite tokens (magic-link style), 7-day TTL.
CREATE TABLE IF NOT EXISTS invites (
  token_hash  TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL,
  email       TEXT NOT NULL,            -- invitee (lowercased)
  role        TEXT NOT NULL DEFAULT 'member',
  invited_by  TEXT,
  expires_at  INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invites_account ON invites(account_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
