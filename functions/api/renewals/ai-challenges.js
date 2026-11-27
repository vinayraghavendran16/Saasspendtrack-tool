import {json,requireEntitledRole} from '../../_shared/util.js';
import {submitChallenge} from '../../_shared/ai-challenge-submission.js';
async function guard(request,env){
 if(['AI_EXPLAINABILITY_ENABLED','PLATFORM_AUDIT_ENABLED','RENEWAL_AI_ANALYTICS_ENABLED'].some(k=>env[k]!=='true'))return {response:new Response(null,{status:404,headers:{'Cache-Control':'no-store'}})};
 return requireEntitledRole(request,env,'owner');
}
const valid=(id,revision)=>typeof id==='string'&&id.trim()&&id.length<=128&&Number.isSafeInteger(revision)&&revision>0;
async function published(db,a,id,rev){return db.prepare("SELECT p.contract_id FROM ai_recommendation_publications p JOIN ai_recommendation_revisions r ON r.account_id=p.account_id AND r.recommendation_id=p.recommendation_id AND r.revision=p.revision WHERE p.account_id=? AND p.recommendation_id=? AND p.revision=? AND r.module='renewals' AND p.contract_id IS NOT NULL").bind(a,id,rev).first();}
export async function onRequestGet({request,env}){
 const g=await guard(request,env);if(g.response)return g.response;
 const q=new URL(request.url).searchParams,id=q.get('id'),revision=Number(q.get('revision'));
 if([...q.keys()].some(k=>!['id','revision'].includes(k))||!valid(id,revision))return json({error:'invalid_reference'},400);
 try{const a=g.membership.account_id;if(!await published(env.DB,a,id,revision))return json({error:'not_found'},404);
 const {results}=await env.DB.prepare("SELECT c.id,c.category,c.reason,c.challenged_at,r.disposition,r.rationale,r.replacement_revision,r.resolved_at FROM ai_recommendation_challenges c JOIN ai_challenge_submissions s ON s.account_id=c.account_id AND s.challenge_id=c.id LEFT JOIN ai_challenge_resolutions r ON r.account_id=c.account_id AND r.challenge_id=c.id WHERE c.account_id=? AND c.recommendation_id=? AND c.revision=? ORDER BY c.challenged_at DESC,c.id LIMIT 101").bind(a,id,revision).all();
 if(!Array.isArray(results))throw Error('invalid history');return json({records:results.slice(0,100),truncated:results.length>100});
 }catch{return json({error:'history_unavailable'},503);}
}
export async function onRequestPost({request,env}){
 const g=await guard(request,env);if(g.response)return g.response;
 if(request.headers.get('Origin')!==new URL(request.url).origin||!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'invalid_origin_or_type'},403);
 let d;try{const reader=request.body.getReader();let size=0,parts=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>20000){await reader.cancel();return json({error:'too_large'},413);}parts.push(value);}d=JSON.parse(await new Blob(parts).text());}catch{return json({error:'invalid_body'},400);}
 if(!d||Object.keys(d).some(k=>!['recommendationId','revision','category','reason'].includes(k))||!valid(d.recommendationId,d.revision)||!['source_accuracy','interpretation','assumption','calculation','completeness','recommendation'].includes(d.category)||typeof d.reason!=='string'||!d.reason.trim()||d.reason.length>4000)return json({error:'invalid_challenge'},400);
 try{if(!await published(env.DB,g.membership.account_id,d.recommendationId,d.revision))return json({error:'not_found'},404);return json(await submitChallenge(env,g,d),201);}catch{return json({error:'challenge_unavailable'},503);}
}
