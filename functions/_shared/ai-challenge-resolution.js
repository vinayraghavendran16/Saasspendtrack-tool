export async function resolveChallenge(env,guard,input){
 if(env.AI_EXPLAINABILITY_ENABLED!=='true'||env.PLATFORM_AUDIT_ENABLED!=='true')throw Error('resolution disabled');
 if(!guard||guard.response||guard.membership?.role!=='owner'||guard.membership?.status!=='active'||!guard.membership.account_id||!guard.user?.email)throw Error('owner authorization required');
 const {challengeId,disposition,rationale,replacementRevision=null}=input;
 if(typeof challengeId!=='string'||!challengeId.trim()||challengeId.length>128||!['upheld','revised','withdrawn','insufficient_evidence'].includes(disposition)||typeof rationale!=='string'||!rationale.trim()||rationale.length>4000||(disposition==='revised'?(!Number.isSafeInteger(replacementRevision)||replacementRevision<1):replacementRevision!==null))throw Error('invalid resolution');
 const account=guard.membership.account_id,actor=guard.user.email,db=env.DB,now=Date.now(),auditId=crypto.randomUUID();
 await db.batch([
 db.prepare("INSERT INTO platform_audit_events(account_id,id,occurred_at,actor_type,actor_id,mode,action,entity_type,entity_id,outcome,correlation_id,changed_fields_json,schema_version) VALUES (?,?,?,'user',?,'api','resolve','ai_challenge',?,'committed',?,'[]',1)").bind(account,auditId,now,actor,challengeId,auditId),
 db.prepare('INSERT INTO ai_challenge_resolutions(account_id,challenge_id,disposition,replacement_revision,rationale,resolved_by,resolved_at,audit_event_id) VALUES (?,?,?,?,?,?,?,?)').bind(account,challengeId,disposition,replacementRevision,rationale,actor,now,auditId)
 ]);
 return {challengeId,disposition,replacementRevision,auditId};
}
