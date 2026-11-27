CREATE TRIGGER IF NOT EXISTS ai_action_validate BEFORE INSERT ON ai_recommendation_actions
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ai_recommendation_publications p WHERE p.account_id=NEW.account_id AND p.recommendation_id=NEW.recommendation_id AND p.revision=NEW.revision AND p.contract_id IS NEW.contract_id) THEN RAISE(ABORT,'publication mismatch') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM platform_audit_events a WHERE a.account_id=NEW.account_id AND a.id=NEW.audit_event_id AND a.entity_type='ai_recommendation' AND a.entity_id=NEW.recommendation_id AND a.action=NEW.action AND a.actor_id=NEW.actor_id AND a.occurred_at=NEW.occurred_at AND a.outcome=CASE WHEN NEW.action IN ('view_rationale','view_evidence') THEN 'observed' ELSE 'committed' END) THEN RAISE(ABORT,'action audit mismatch') END;
END;
