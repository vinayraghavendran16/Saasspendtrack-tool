CREATE TRIGGER IF NOT EXISTS recovery_freeze_app_data_insert
BEFORE INSERT ON app_data
BEGIN
  SELECT RAISE(ABORT, 'workspace_writes_frozen');
END;

CREATE TRIGGER IF NOT EXISTS recovery_freeze_app_data_update
BEFORE UPDATE ON app_data
BEGIN
  SELECT RAISE(ABORT, 'workspace_writes_frozen');
END;

CREATE TRIGGER IF NOT EXISTS recovery_freeze_app_data_delete
BEFORE DELETE ON app_data
BEGIN
  SELECT RAISE(ABORT, 'workspace_writes_frozen');
END;
