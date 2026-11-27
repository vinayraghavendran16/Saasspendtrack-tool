-- Additive governance schema. Rehearse before deployment.
CREATE TABLE IF NOT EXISTS vendor_ownership (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 vendor_id TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('business','finance','technical','backup','escalation')),
 member_email TEXT NOT NULL REFERENCES memberships(email),
 assigned_by TEXT NOT NULL,
 assigned_at INTEGER NOT NULL,
 accepted_at INTEGER,
 PRIMARY KEY(account_id,vendor_id,role)
);
CREATE INDEX IF NOT EXISTS idx_vendor_ownership_member ON vendor_ownership(account_id,member_email);
CREATE TABLE IF NOT EXISTS vendor_cases (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 id TEXT NOT NULL,
 vendor_id TEXT NOT NULL,
 direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
 severity TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
 status TEXT NOT NULL CHECK(status IN ('open','awaiting_vendor','awaiting_internal','resolved','closed')),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 240),
 owner_email TEXT REFERENCES memberships(email),
 response_due_at INTEGER,
 resolution_due_at INTEGER,
 next_action TEXT,
 created_by TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(account_id,id)
);
CREATE INDEX IF NOT EXISTS idx_vendor_cases_status ON vendor_cases(account_id,status,resolution_due_at);
CREATE TABLE IF NOT EXISTS vendor_case_events (
 account_id TEXT NOT NULL,
 case_id TEXT NOT NULL,
 id TEXT NOT NULL,
 actor_email TEXT NOT NULL,
 kind TEXT NOT NULL,
 detail TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,case_id,id),
 FOREIGN KEY(account_id,case_id) REFERENCES vendor_cases(account_id,id)
);
CREATE TABLE IF NOT EXISTS governance_notifications (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 id TEXT NOT NULL,
 vendor_id TEXT NOT NULL,
 kind TEXT NOT NULL,
 deadline_at INTEGER NOT NULL,
 milestone INTEGER NOT NULL,
 recipient_email TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','leased','accepted','dead','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at INTEGER NOT NULL,
 lease_until INTEGER,
 acknowledged_at INTEGER,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,id),
 UNIQUE(account_id,vendor_id,kind,deadline_at,milestone,recipient_email)
);
CREATE INDEX IF NOT EXISTS idx_governance_notifications_due ON governance_notifications(status,next_attempt_at);
