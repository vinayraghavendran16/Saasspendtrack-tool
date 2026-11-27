-- Historical aggregate observations; no employee PII.
CREATE TABLE IF NOT EXISTS pupm_population_observations (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 id TEXT NOT NULL,
 scope_type TEXT NOT NULL CHECK(scope_type IN ('organization','department','application')),
 scope_id TEXT NOT NULL CHECK(length(trim(scope_id)) BETWEEN 1 AND 256),
 month TEXT NOT NULL CHECK(length(month)=7 AND month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]' AND substr(month,6,2) BETWEEN '01' AND '12'),
 denominator TEXT NOT NULL CHECK(denominator IN ('purchased_seats','assigned_users','active_users','employees')),
 population INTEGER NOT NULL CHECK(typeof(population)='integer' AND population BETWEEN 0 AND 9007199254740991),
 active_window_days INTEGER,
 source_id TEXT NOT NULL CHECK(length(trim(source_id)) BETWEEN 1 AND 256),
 source_record_id TEXT NOT NULL CHECK(length(trim(source_record_id)) BETWEEN 1 AND 256),
 recorded_at INTEGER NOT NULL CHECK(typeof(recorded_at)='integer' AND recorded_at>0),
 supersedes_id TEXT,
 PRIMARY KEY(account_id,id),
 UNIQUE(account_id,source_id,source_record_id),
 UNIQUE(account_id,supersedes_id),
 FOREIGN KEY(account_id,supersedes_id) REFERENCES pupm_population_observations(account_id,id),
 CHECK((denominator='active_users' AND active_window_days IS NOT NULL AND typeof(active_window_days)='integer' AND active_window_days BETWEEN 1 AND 366) OR (denominator<>'active_users' AND active_window_days IS NULL))
);
CREATE INDEX IF NOT EXISTS pupm_population_period ON pupm_population_observations(account_id,scope_type,scope_id,month,denominator);
CREATE TRIGGER IF NOT EXISTS pupm_population_correction BEFORE INSERT ON pupm_population_observations WHEN NEW.supersedes_id IS NOT NULL
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM pupm_population_observations p WHERE p.account_id=NEW.account_id AND p.id=NEW.supersedes_id AND p.scope_type=NEW.scope_type AND p.scope_id=NEW.scope_id AND p.month=NEW.month AND p.denominator=NEW.denominator AND p.active_window_days IS NEW.active_window_days AND p.source_id=NEW.source_id AND p.recorded_at<NEW.recorded_at) THEN RAISE(ABORT,'invalid correction') END;
END;
CREATE TRIGGER IF NOT EXISTS pupm_population_no_update BEFORE UPDATE ON pupm_population_observations BEGIN SELECT RAISE(ABORT,'immutable observation'); END;
CREATE TRIGGER IF NOT EXISTS pupm_population_no_delete BEFORE DELETE ON pupm_population_observations BEGIN SELECT RAISE(ABORT,'immutable observation'); END;
