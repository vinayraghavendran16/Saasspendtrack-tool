import {json,requireEntitledRole} from '../../_shared/util.js';
import {summarizeRenewalAI} from '../../_shared/renewal-ai-analytics.js';
export async function onRequestGet({request,env}){
 if(env.AI_EXPLAINABILITY_ENABLED!=='true'||env.PLATFORM_AUDIT_ENABLED!=='true'||env.RENEWAL_AI_ANALYTICS_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 const u=new URL(request.url),now=Date.now();
 const parse=k=>{const s=u.searchParams.get(k);return s&&/^\d{1,13}$/.test(s)?Number(s):NaN;};
 const start=parse('start'),end=parse('end'),asOf=u.searchParams.has('asOf')?parse('asOf'):now;
 if([...u.searchParams.keys()].some(k=>!['start','end','asOf'].includes(k))||! [start,end,asOf].every(Number.isSafeInteger)||start<0||end<=start||end-start>366*86400000||asOf<end||asOf>now)return json({error:'invalid_window'},400);
 const account=g.membership.account_id,db=env.DB;
 const cohort="SELECT p.recommendation_id,p.revision,p.contract_id,p.published_at FROM ai_recommendation_publications p JOIN ai_recommendation_revisions r ON r.account_id=p.account_id AND r.recommendation_id=p.recommendation_id AND r.revision=p.revision WHERE p.account_id=? AND r.module='renewals' AND p.contract_id IS NOT NULL AND p.published_at>=? AND p.published_at<?";
 const scoped=(sql,...args)=>db.prepare(sql).bind(account,start,end,...args);
 try{
 const results=await db.batch([
 scoped(cohort+' LIMIT 10001'),
 scoped('WITH cohort AS ('+cohort+') SELECT a.id,a.recommendation_id,a.revision,a.action,a.occurred_at FROM ai_recommendation_actions a JOIN cohort p ON p.recommendation_id=a.recommendation_id AND p.revision=a.revision WHERE a.account_id=? AND a.occurred_at<=? LIMIT 10001',account,asOf),
 scoped('WITH cohort AS ('+cohort+') SELECT c.id,c.recommendation_id,c.revision,c.challenged_at FROM ai_recommendation_challenges c JOIN cohort p ON p.recommendation_id=c.recommendation_id AND p.revision=c.revision JOIN ai_challenge_submissions s ON s.account_id=c.account_id AND s.challenge_id=c.id WHERE c.account_id=? AND c.challenged_at<=? LIMIT 10001',account,asOf),
 scoped('WITH cohort AS ('+cohort+') SELECT r.challenge_id,r.disposition,r.resolved_at FROM ai_challenge_resolutions r JOIN ai_recommendation_challenges c ON c.account_id=r.account_id AND c.id=r.challenge_id JOIN ai_challenge_submissions s ON s.account_id=c.account_id AND s.challenge_id=c.id JOIN cohort p ON p.recommendation_id=c.recommendation_id AND p.revision=c.revision WHERE r.account_id=? AND r.resolved_at<=? LIMIT 10001',account,asOf)
 ]);
 if(results.length!==4||results.some(r=>r.success===false||!Array.isArray(r.results)))throw Error('snapshot failed');
 const [publications,actions,challenges,resolutions]=results.map(r=>r.results);
 if([publications,actions,challenges,resolutions].some(r=>r.length>10000))return json({error:'cohort_too_large'},422);
 return json(summarizeRenewalAI({publications,actions,challenges,resolutions,start,end,asOf}));
 }catch{return json({error:'analytics_unavailable'},503);}
}
