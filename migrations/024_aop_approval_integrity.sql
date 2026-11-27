CREATE TRIGGER IF NOT EXISTS aop_approved_version_no_delete BEFORE DELETE ON aop_scenario_versions
WHEN EXISTS(SELECT 1 FROM aop_approvals a WHERE a.account_id=OLD.account_id AND a.scenario_id=OLD.scenario_id AND a.revision=OLD.revision)
BEGIN SELECT RAISE(ABORT,'approved version cannot be deleted'); END;
CREATE TRIGGER IF NOT EXISTS aop_approval_no_update BEFORE UPDATE ON aop_approvals
BEGIN SELECT RAISE(ABORT,'approval is immutable'); END;
CREATE TRIGGER IF NOT EXISTS aop_approval_no_delete BEFORE DELETE ON aop_approvals
BEGIN SELECT RAISE(ABORT,'approval is immutable'); END;
