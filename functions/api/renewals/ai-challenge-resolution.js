import {json,requireEntitledRole} from '../../_shared/util.js';
import {resolveChallenge} from '../../_shared/ai-challenge-resolution.js';
export async function onRequestPost({request,env}){
 if(['AI_EXPLAINABILITY_ENABLED','PLATFORM_AUDIT_ENABLED','RENEWAL_AI_ANALYTICS_ENABLED'].some(k=>env[k]!=='true'))return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 if(request.headers.get('Origin')!==new URL(request.url).origin||!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'invalid_origin_or_type'},403);
 let d;try{const reader=request.body.getReader();let size=0,parts=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>20000){await reader.cancel();return json({error:'too_large'},413);}parts.push(value);}d=JSON.parse(await new Blob(parts).text());}catch{return json({error:'invalid_body'},400);}
 if(!d||Object.keys(d).some(k=>!['challengeId','disposition','rationale','replacementRevision'].includes(k))||typeof d.challengeId!=='string'||!d.challengeId.trim()||d.challengeId.length>128||!['upheld','revised','withdrawn','insufficient_evidence'].includes(d.disposition)||typeof d.rationale!=='string'||!d.rationale.trim()||d.rationale.length>4000||(d.disposition==='revised'?(!Number.isSafeInteger(d.replacementRevision)||d.replacementRevision<1):d.replacementRevision!=null))return json({error:'invalid_resolution'},400);
 try{
 const a=g.membership.account_id,db=env.DB;
 const row=await db.prepare("SELECT c.id FROM ai_recommendation_challenges c JOIN ai_challenge_submissions s ON s.account_id=c.account_id AND s.challenge_id=c.id JOIN ai_recommendation_revisions r ON r.account_id=c.account_id AND r.recommendation_id=c.recommendation_id AND r.revision=c.revision WHERE c.account_id=? AND c.id=? AND r.module='renewals'").bind(a,d.challengeId).first();
 if(!row)return json({error:'not_found'},404);
 return json(await resolveChallenge(env,g,d),201);
 }catch{return json({error:'resolution_not_committed'},409);}
}
