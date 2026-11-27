import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestGet({request,env}){
 if(env.AI_EXPLAINABILITY_ENABLED!=='true'||env.PLATFORM_AUDIT_ENABLED!=='true'||env.RENEWAL_AI_ANALYTICS_ENABLED!=='true')return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 const u=new URL(request.url),id=u.searchParams.get('id'),raw=u.searchParams.get('revision'),revision=Number(raw);
 if([...u.searchParams.keys()].some(k=>!['id','revision'].includes(k))||u.searchParams.getAll('id').length!==1||u.searchParams.getAll('revision').length!==1||!id||id.length>128||!raw||!/^\d+$/.test(raw)||!Number.isSafeInteger(revision)||revision<1)return json({error:'invalid_reference'},400);
 const a=g.membership.account_id,db=env.DB;
 try{
 const row=await db.prepare("SELECT r.rationale,r.assumptions_json,r.limitations_json,r.model_version,p.contract_id,p.published_at FROM ai_recommendation_publications p JOIN ai_recommendation_revisions r ON r.account_id=p.account_id AND r.recommendation_id=p.recommendation_id AND r.revision=p.revision WHERE p.account_id=? AND p.recommendation_id=? AND p.revision=? AND r.module='renewals' AND p.contract_id IS NOT NULL").bind(a,id,revision).first();
 if(!row)return json({error:'not_found'},404);
 const {results}=await db.prepare("SELECT e.id,e.artifact_type,e.evidence_kind,CASE WHEN v.digest IS NOT NULL AND ar.status='active' THEN 'available' ELSE 'unavailable' END AS availability FROM ai_recommendation_evidence e LEFT JOIN ai_artifacts ar ON ar.account_id=e.account_id AND ar.id=e.artifact_id LEFT JOIN ai_artifact_versions v ON v.account_id=e.account_id AND v.artifact_id=e.artifact_id AND v.digest=e.artifact_digest WHERE e.account_id=? AND e.recommendation_id=? AND e.revision=? ORDER BY e.id LIMIT 21").bind(a,id,revision).all();
 if(!Array.isArray(results)||results.length<1||results.length>20)throw Error('invalid evidence');
 const assumptions=JSON.parse(row.assumptions_json),limitations=JSON.parse(row.limitations_json);
 if(!Array.isArray(assumptions)||!Array.isArray(limitations)||[...assumptions,...limitations].some(x=>typeof x!=='string'))throw Error('invalid rationale');
 const now=Date.now(),audit=crypto.randomUUID(),action=crypto.randomUUID();
 const writes=await db.batch([
 db.prepare("INSERT INTO platform_audit_events(account_id,id,occurred_at,actor_type,actor_id,mode,action,entity_type,entity_id,outcome,correlation_id,changed_fields_json,schema_version) VALUES (?,?,?,'user',?,'api','view_rationale','ai_recommendation',?,'observed',?,'[]',1)").bind(a,audit,now,g.user.email,id,action),
 db.prepare("INSERT INTO ai_recommendation_actions(account_id,id,recommendation_id,revision,contract_id,action,actor_id,occurred_at,audit_event_id) VALUES (?,?,?,?,?,'view_rationale',?,?,?)").bind(a,action,id,revision,row.contract_id,g.user.email,now,audit)
 ]);
 if(!Array.isArray(writes)||writes.length!==2||writes.some(x=>x.success===false))throw Error('audit unavailable');
 return json({recommendationId:id,revision,contractId:row.contract_id,publishedAt:row.published_at,rationale:row.rationale,assumptions,limitations,modelVersion:row.model_version,evidence:results});
 }catch{return json({error:'detail_unavailable'},503);}
}
