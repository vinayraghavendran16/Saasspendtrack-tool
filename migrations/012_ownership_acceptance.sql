CREATE TRIGGER IF NOT EXISTS ownership_accept_audit AFTER UPDATE OF accepted_at ON vendor_ownership
WHEN OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL
BEGIN
 INSERT INTO governance_audit(account_id,id,actor_email,kind,subject_id,detail,created_at)
 VALUES(NEW.account_id,lower(hex(randomblob(16))),NEW.member_email,'ownership_accepted',NEW.vendor_id,json_object('role',NEW.role,'assigned_at',NEW.assigned_at),NEW.accepted_at);
END;
