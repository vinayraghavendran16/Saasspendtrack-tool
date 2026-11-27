export async function submitChallenge(env,guard,input){
 if(env.AI_EXPLAINABILITY_ENABLED!=='true'||env.PLATFORM_AUDIT_ENABLED!=='true')throw Error('challenge disabled');
 if(!guard||guard.response||guard.membership?.role!=='owner'||guard.membership?.status!=='active'||!guard.membership.account_id||!guard.user?.email)throw Error('owner authorization required');
 const {recommendationId,revision,category,reason}=input;
 if(typeof recommendationId!=='string'||!recommendationId.trim()||recommendationId.length>128||!Number.isSafeInteger(revision)||revision<1||!['source_accuracy','interpretation','assumption','calculation','completeness','recommendation'].includes(category)||typeof reason!=='string'||!reason.trim()||reason.length>4000)throw Error('invalid challenge');
 const account=guard.membership.account_id,actor=guard.user.email,db=env.DB;
 const p=await db.prepare('SELECT contract_id FROM ai_recommendation_publications WHERE account_id=? AND recommendation_id=? AND revision=?').bind(account,recommendationId,revision).first();
 if(!p)throw Error('publication unavailable');
 const challengeId=crypto.randomUUID(),actionId=crypto.randomUUID(),auditId=crypto.randomUUID(),now=Date.now();
 await db.batch([
 db.prepare("INSERT INTO platform_audit_events(account_id,id,occurred_at,actor_type,actor_id,mode,action,entity_type,entity_id,outcome,correlation_id,changed_fields_json,schema_version) VALUES (?,?,?,'user',?,'api','challenge','ai_recommendation',?,'committed',?,'[]',1)").bind(account,auditId,now,actor,recommendationId,challengeId),
 db.prepare('INSERT INTO ai_recommendation_actions(account_id,id,recommendation_id,revision,contract_id,action,actor_id,occurred_at,audit_event_id) VALUES (?,?,?,?,?,?,?,?,?)').bind(account,actionId,recommendationId,revision,p.contract_id,'challenge',actor,now,auditId),
 db.prepare('INSERT INTO ai_recommendation_challenges(account_id,id,recommendation_id,revision,category,reason,challenged_by,challenged_at) VALUES (?,?,?,?,?,?,?,?)').bind(account,challengeId,recommendationId,revision,category,reason,actor,now),
 db.prepare('INSERT INTO ai_challenge_submissions(account_id,challenge_id,action_id) VALUES (?,?,?)').bind(account,challengeId,actionId)
 ]);
 return {challengeId,actionId,auditId};
}
