import {verifyDocumentEvidence} from './ai-evidence-verification.js';
import {ownerArtifactResolver} from './ai-artifact-resolver.js';
// Internal service only. Caller must obtain guard from requireEntitledRole(owner).
export async function publishRecommendation(env,guard,input){
 if(env.AI_EXPLAINABILITY_ENABLED!=='true'||env.PLATFORM_AUDIT_ENABLED!=='true')throw Error('publication disabled');
 const db=env.DB,resolve=ownerArtifactResolver(db,guard),account=guard.membership.account_id;
 const {recommendationId,revision,module,rationale,assumptions,limitations,modelVersion,contractId=null,evidence}=input;
 const valid=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
 if(!valid(recommendationId,128)||!Number.isSafeInteger(revision)||revision<1||!valid(module,80)||!valid(rationale,8000)||!valid(modelVersion,256)||!Array.isArray(evidence)||evidence.length<1||evidence.length>20||!Array.isArray(assumptions)||!Array.isArray(limitations)||[...assumptions,...limitations].some(x=>!valid(x,2000))||JSON.stringify(assumptions).length>16000||JSON.stringify(limitations).length>16000||(contractId!==null&&!valid(contractId,256)))throw Error('invalid recommendation');
 const refs=structuredClone(evidence);
 for(const ref of refs){
 if(!['msa','order_form','sow','amendment','invoice','spreadsheet','report','email','other'].includes(ref.artifactType)||!['direct','derived','inference'].includes(ref.evidenceKind))throw Error('invalid evidence type');
 if((await verifyDocumentEvidence(account,ref,resolve)).status!=='verified_text_span')throw Error('unverified evidence');
 }
 const now=Date.now(),auditId=crypto.randomUUID();
 const statements=[db.prepare('INSERT INTO ai_recommendation_revisions(account_id,recommendation_id,revision,module,rationale,assumptions_json,limitations_json,model_version,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(account,recommendationId,revision,module,rationale,JSON.stringify(assumptions),JSON.stringify(limitations),modelVersion,now)];
 for(const ref of refs)statements.push(db.prepare('INSERT INTO ai_recommendation_evidence(account_id,recommendation_id,revision,id,artifact_type,artifact_id,artifact_digest,locator_json,evidence_kind) VALUES (?,?,?,?,?,?,?,?,?)').bind(account,recommendationId,revision,crypto.randomUUID(),ref.artifactType,ref.artifactId,ref.artifactDigest,JSON.stringify({page:ref.locator.page,start:ref.locator.start,end:ref.locator.end}),ref.evidenceKind));
 statements.push(db.prepare("INSERT INTO platform_audit_events(account_id,id,occurred_at,actor_type,actor_id,initiator_id,mode,action,entity_type,entity_id,outcome,correlation_id,changed_fields_json,schema_version) VALUES (?,?,?,'ai','trackai',?,'ai_assisted','generate','ai_recommendation',?,'proposed',?,'[]',1)").bind(account,auditId,now,guard.user.email,recommendationId,auditId));
 statements.push(db.prepare('INSERT INTO ai_recommendation_publications(account_id,recommendation_id,revision,contract_id,audit_event_id,published_at) VALUES (?,?,?,?,?,?)').bind(account,recommendationId,revision,contractId,auditId,now));
 await db.batch(statements);
 return {recommendationId,revision,auditId,status:'published'};
}
