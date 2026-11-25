ALTER TABLE ai_egress_audit ADD COLUMN request_id TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_egress_request ON ai_egress_audit(account_id,request_id);
