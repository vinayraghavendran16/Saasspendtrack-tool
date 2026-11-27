import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestGet({request,env}){
 if(['AI_EXPLAINABILITY_ENABLED','PLATFORM_AUDIT_ENABLED','RENEWAL_AI_ANALYTICS_ENABLED'].some(k=>env[k]!=='true'))return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 const q=new URL(request.url).searchParams,id=q.get('id'),before=Number(q.get('before')??Number.MAX_SAFE_INTEGER);
 if([...q.keys()].some(k=>!['id','before'].includes(k))||!id||id.length>128||!Number.isSafeInteger(before)||before<1)return json({error:'invalid_reference'},400);
 try{const {results}=await env.DB.prepare("SELECT p.revision,p.published_at,p.contract_id,r.model_version FROM ai_recommendation_publications p JOIN ai_recommendation_revisions r ON r.account_id=p.account_id AND r.recommendation_id=p.recommendation_id AND r.revision=p.revision WHERE p.account_id=? AND p.recommendation_id=? AND p.revision<? AND r.module='renewals' AND p.contract_id IS NOT NULL ORDER BY p.revision DESC LIMIT 51").bind(g.membership.account_id,id,before).all();
 if(!Array.isArray(results))throw Error('invalid history');const records=results.slice(0,50);return json({records,nextBefore:results.length>50?records.at(-1).revision:null});
 }catch{return json({error:'history_unavailable'},503);}
}
