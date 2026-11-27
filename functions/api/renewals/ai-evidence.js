import {json,requireEntitledRole} from '../../_shared/util.js';
import {ownerArtifactResolver} from '../../_shared/ai-artifact-resolver.js';
import {verifyDocumentEvidence} from '../../_shared/ai-evidence-verification.js';
export async function onRequestGet({request,env}){
 if(env.AI_EXPLAINABILITY_ENABLED!=='true'||env.PLATFORM_AUDIT_ENABLED!=='true'||env.RENEWAL_AI_ANALYTICS_ENABLED!=='true')return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 const q=new URL(request.url).searchParams,id=q.get('id'),evidenceId=q.get('evidenceId'),raw=q.get('revision'),revision=Number(raw);
 if([...q.keys()].some(k=>!['id','revision','evidenceId'].includes(k))||['id','revision','evidenceId'].some(k=>q.getAll(k).length!==1)||!id||id.length>128||!evidenceId||evidenceId.length>128||!raw||!/^\d+$/.test(raw)||!Number.isSafeInteger(revision)||revision<1)return json({error:'invalid_reference'},400);
 const a=g.membership.account_id,db=env.DB;
 try{
 const e=await db.prepare("SELECT e.artifact_id,e.artifact_digest,e.artifact_type,e.evidence_kind,e.locator_json,p.contract_id FROM ai_recommendation_evidence e JOIN ai_recommendation_publications p ON p.account_id=e.account_id AND p.recommendation_id=e.recommendation_id AND p.revision=e.revision JOIN ai_recommendation_revisions r ON r.account_id=p.account_id AND r.recommendation_id=p.recommendation_id AND r.revision=p.revision WHERE e.account_id=? AND e.recommendation_id=? AND e.revision=? AND e.id=? AND r.module='renewals' AND p.contract_id IS NOT NULL").bind(a,id,revision,evidenceId).first();
 if(!e)return json({error:'not_found'},404);
 const resolve=ownerArtifactResolver(db,g),artifact=await resolve(a,e.artifact_id,e.artifact_digest);
 if(!artifact)return json({error:'evidence_unavailable'},409);
 const l=JSON.parse(e.locator_json);
 if(!l||!Number.isSafeInteger(l.page)||l.page<1||!Number.isSafeInteger(l.start)||!Number.isSafeInteger(l.end)||l.start<0||l.end<=l.start||l.end-l.start>4000||typeof artifact.pages[l.page-1]!=='string'||l.end>artifact.pages[l.page-1].length)return json({error:'evidence_unavailable'},409);
 const quote=artifact.pages[l.page-1].slice(l.start,l.end);
 const verified=await verifyDocumentEvidence(a,{artifactId:e.artifact_id,artifactDigest:e.artifact_digest,locator:{...l,quote}},async()=>artifact);
 if(verified.status!=='verified_text_span')return json({error:'evidence_unavailable'},409);
 const now=Date.now(),audit=crypto.randomUUID(),action=crypto.randomUUID();
 const writes=await db.batch([
 db.prepare("INSERT INTO platform_audit_events(account_id,id,occurred_at,actor_type,actor_id,mode,action,entity_type,entity_id,outcome,correlation_id,changed_fields_json,schema_version) SELECT ?,?,?,'user',?,'api','view_evidence','ai_recommendation',?,'observed',?,'[]',1 WHERE EXISTS(SELECT 1 FROM ai_artifacts ar JOIN ai_artifact_versions v ON v.account_id=ar.account_id AND v.artifact_id=ar.id WHERE ar.account_id=? AND ar.id=? AND ar.status='active' AND v.digest=?)").bind(a,audit,now,g.user.email,id,action,a,e.artifact_id,e.artifact_digest),
 db.prepare("INSERT INTO ai_recommendation_actions(account_id,id,recommendation_id,revision,contract_id,action,actor_id,occurred_at,audit_event_id) VALUES (?,?,?,?,?,'view_evidence',?,?,?)").bind(a,action,id,revision,e.contract_id,g.user.email,now,audit)
 ]);
 if(!Array.isArray(writes)||writes.length!==2||writes.some(x=>x.success===false))throw Error('audit unavailable');
 return json({recommendationId:id,revision,evidenceId,artifactType:e.artifact_type,evidenceKind:e.evidence_kind,artifactDigest:e.artifact_digest,page:l.page,start:l.start,end:l.end,quote,verification:'verified_text_span'});
 }catch{return json({error:'evidence_unavailable'},503);}
}
