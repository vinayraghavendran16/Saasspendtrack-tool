CREATE TABLE IF NOT EXISTS governance_audit (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 id TEXT NOT NULL,
 actor_email TEXT NOT NULL,
 kind TEXT NOT NULL,
 subject_id TEXT NOT NULL,
 detail TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,id)
);
CREATE TRIGGER IF NOT EXISTS ownership_member_insert BEFORE INSERT ON vendor_ownership
WHEN NOT EXISTS (SELECT 1 FROM memberships WHERE email=NEW.member_email AND account_id=NEW.account_id AND status='active')
BEGIN SELECT RAISE(ABORT,'invalid ownership member'); END;
CREATE TRIGGER IF NOT EXISTS ownership_member_update BEFORE UPDATE OF member_email,account_id ON vendor_ownership
WHEN NOT EXISTS (SELECT 1 FROM memberships WHERE email=NEW.member_email AND account_id=NEW.account_id AND status='active')
BEGIN SELECT RAISE(ABORT,'invalid ownership member'); END;
CREATE TRIGGER IF NOT EXISTS case_member_insert BEFORE INSERT ON vendor_cases
WHEN NEW.owner_email IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE email=NEW.owner_email AND account_id=NEW.account_id AND status='active')
BEGIN SELECT RAISE(ABORT,'invalid case member'); END;
CREATE TRIGGER IF NOT EXISTS case_member_update BEFORE UPDATE OF owner_email,account_id ON vendor_cases
WHEN NEW.owner_email IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE email=NEW.owner_email AND account_id=NEW.account_id AND status='active')
BEGIN SELECT RAISE(ABORT,'invalid case member'); END;
