CREATE TRIGGER IF NOT EXISTS vendor_case_status_audit AFTER UPDATE OF status ON vendor_cases
WHEN OLD.status<>NEW.status
BEGIN
 INSERT INTO vendor_case_events(account_id,case_id,id,actor_email,kind,detail,created_at)
 VALUES(NEW.account_id,NEW.id,lower(hex(randomblob(16))),NULL,'status_changed',json_object('from',OLD.status,'to',NEW.status),NEW.updated_at);
END;
