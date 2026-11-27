CREATE TABLE IF NOT EXISTS pupm_source_selections (
 account_id TEXT NOT NULL,
 id TEXT NOT NULL,
 observation_id TEXT NOT NULL,
 selected_by TEXT NOT NULL CHECK(length(trim(selected_by))>0),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 1000),
 selected_at INTEGER NOT NULL CHECK(typeof(selected_at)='integer' AND selected_at>0),
 PRIMARY KEY(account_id,id),
 FOREIGN KEY(account_id,observation_id) REFERENCES pupm_population_observations(account_id,id)
);
CREATE INDEX IF NOT EXISTS pupm_selection_observation ON pupm_source_selections(account_id,observation_id,selected_at);
CREATE TRIGGER IF NOT EXISTS pupm_selection_current BEFORE INSERT ON pupm_source_selections
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM pupm_population_observations p WHERE p.account_id=NEW.account_id AND p.id=NEW.observation_id AND NOT EXISTS(SELECT 1 FROM pupm_population_observations n WHERE n.account_id=p.account_id AND n.supersedes_id=p.id)) THEN RAISE(ABORT,'observation not current') END;
END;
CREATE TRIGGER IF NOT EXISTS pupm_selection_no_update BEFORE UPDATE ON pupm_source_selections BEGIN SELECT RAISE(ABORT,'immutable selection'); END;
CREATE TRIGGER IF NOT EXISTS pupm_selection_no_delete BEFORE DELETE ON pupm_source_selections BEGIN SELECT RAISE(ABORT,'immutable selection'); END;
