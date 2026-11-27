CREATE TABLE IF NOT EXISTS executive_action_events (
 account_id TEXT NOT NULL, action_id TEXT NOT NULL, id TEXT NOT NULL,
 from_status TEXT NOT NULL, to_status TEXT NOT NULL, actor_email TEXT NOT NULL,
 rationale TEXT NOT NULL CHECK(length(trim(rationale)) BETWEEN 1 AND 4000), occurred_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,action_id,id),
 FOREIGN KEY(account_id,action_id) REFERENCES executive_actions(account_id,id),
 CHECK(from_status='open' AND to_status IN ('reviewed','dismissed'))
);
CREATE TRIGGER IF NOT EXISTS action_review_event_apply AFTER INSERT ON executive_action_events
BEGIN
 UPDATE executive_actions SET status=NEW.to_status WHERE account_id=NEW.account_id AND id=NEW.action_id AND status=NEW.from_status;
 SELECT CASE WHEN changes()<>1 THEN RAISE(ABORT,'action_state_conflict') END;
END;
CREATE TRIGGER IF NOT EXISTS action_review_event_no_update BEFORE UPDATE ON executive_action_events
BEGIN SELECT RAISE(ABORT,'action_event_immutable'); END;
CREATE TRIGGER IF NOT EXISTS action_review_event_no_delete BEFORE DELETE ON executive_action_events
BEGIN SELECT RAISE(ABORT,'action_event_immutable'); END;
