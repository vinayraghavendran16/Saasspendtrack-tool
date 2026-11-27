import {json,requireEntitledRole} from '../../_shared/util.js';
import {recordCustomerResponse} from '../../_shared/ai-customer-action.js';
export async function onRequestPost({request,env}){
 if(['AI_EXPLAINABILITY_ENABLED','PLATFORM_AUDIT_ENABLED','RENEWAL_AI_ANALYTICS_ENABLED'].some(k=>env[k]!=='true'))return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 if(request.headers.get('Origin')!==new URL(request.url).origin||!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'invalid_origin_or_type'},403);
 let d;try{const reader=request.body.getReader();let size=0,parts=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return json({error:'too_large'},413);}parts.push(value);}d=JSON.parse(await new Blob(parts).text());}catch{return json({error:'invalid_body'},400);}
 if(!d||Object.keys(d).some(k=>!['recommendationId','revision','action'].includes(k))||typeof d.recommendationId!=='string'||!d.recommendationId.trim()||d.recommendationId.length>128||!Number.isSafeInteger(d.revision)||d.revision<1||!['accept','reject','defer'].includes(d.action))return json({error:'invalid_response'},400);
 try{const p=await env.DB.prepare("SELECT p.contract_id FROM ai_recommendation_publications p JOIN ai_recommendation_revisions r ON r.account_id=p.account_id AND r.recommendation_id=p.recommendation_id AND r.revision=p.revision WHERE p.account_id=? AND p.recommendation_id=? AND p.revision=? AND r.module='renewals' AND p.contract_id IS NOT NULL").bind(g.membership.account_id,d.recommendationId,d.revision).first();
 if(!p)return json({error:'not_found'},404);return json(await recordCustomerResponse(env,g,d),201);
 }catch{return json({error:'response_unavailable'},503);}
}
