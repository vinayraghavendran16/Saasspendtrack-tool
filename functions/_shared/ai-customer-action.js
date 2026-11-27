// Internal service: guard must come from requireEntitledRole(owner).
// Approval, execution, challenge and outcome require separate guarded workflows.
export async function recordCustomerResponse(env,guard,input){
 if(env.AI_EXPLAINABILITY_ENABLED!=='true'||env.PLATFORM_AUDIT_ENABLED!=='true')throw Error('action disabled');
 if(!guard||guard.response||guard.membership?.role!=='owner'||guard.membership?.status!=='active'||!guard.membership.account_id||!guard.user?.email)throw Error('owner authorization required');
 const {recommendationId,revision,action}=input;
 if(typeof recommendationId!=='string'||!recommendationId.trim()||recommendationId.length>128||!Number.isSafeInteger(revision)||revision<1||!['accept','reject','defer'].includes(action))throw Error('invalid response');
 const db=env.DB,account=guard.membership.account_id,actor=guard.user.email;
 const p=await db.prepare('SELECT contract_id FROM ai_recommendation_publications WHERE account_id=? AND recommendation_id=? AND revision=?').bind(account,recommendationId,revision).first();
 if(!p)throw Error('publication unavailable');
 const id=crypto.randomUUID(),auditId=crypto.randomUUID(),now=Date.now();
 await db.batch([
 db.prepare("INSERT INTO platform_audit_events(account_id,id,occurred_at,actor_type,actor_id,mode,action,entity_type,entity_id,outcome,correlation_id,changed_fields_json,schema_version) VALUES (?,?,?,'user',?,'api',?,'ai_recommendation',?,'committed',?,'[]',1)").bind(account,auditId,now,actor,action,recommendationId,id),
 db.prepare('INSERT INTO ai_recommendation_actions(account_id,id,recommendation_id,revision,contract_id,action,actor_id,occurred_at,audit_event_id) VALUES (?,?,?,?,?,?,?,?,?)').bind(account,id,recommendationId,revision,p.contract_id,action,actor,now,auditId)
 ]);
 return {id,auditId,recommendationId,revision,action};
}
