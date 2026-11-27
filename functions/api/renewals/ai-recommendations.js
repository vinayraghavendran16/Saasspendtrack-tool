import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestGet({request,env}){
 if(env.AI_EXPLAINABILITY_ENABLED!=='true'||env.PLATFORM_AUDIT_ENABLED!=='true'||env.RENEWAL_AI_ANALYTICS_ENABLED!=='true')return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 const u=new URL(request.url),parse=k=>{const v=u.searchParams.get(k);return v&&/^\d{1,13}$/.test(v)?Number(v):NaN;};
 const start=parse('start'),end=parse('end');
 if([...u.searchParams.keys()].some(k=>!['start','end','cursor'].includes(k))||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start||end>Date.now()||end-start>366*86400000)return json({error:'invalid_window'},400);
 const cursor=u.searchParams.get('cursor')??'';
 if(cursor.length>256)return json({error:'invalid_cursor'},400);
 try{
 const {results}=await env.DB.prepare("WITH cohort AS (SELECT p.recommendation_id,MAX(p.revision) AS revision FROM ai_recommendation_publications p JOIN ai_recommendation_revisions r ON r.account_id=p.account_id AND r.recommendation_id=p.recommendation_id AND r.revision=p.revision WHERE p.account_id=? AND r.module='renewals' AND p.contract_id IS NOT NULL AND p.published_at>=? AND p.published_at<? AND p.recommendation_id>? GROUP BY p.recommendation_id ORDER BY p.recommendation_id LIMIT 51) SELECT p.recommendation_id,p.revision,p.contract_id,p.published_at FROM cohort c JOIN ai_recommendation_publications p ON p.account_id=? AND p.recommendation_id=c.recommendation_id AND p.revision=c.revision ORDER BY p.recommendation_id LIMIT 51").bind(g.membership.account_id,start,end,cursor,g.membership.account_id).all();
 if(!Array.isArray(results))throw Error('invalid register');
 const records=results.slice(0,50);
 return json({records,nextCursor:results.length>50?records.at(-1).recommendation_id:null,cohortBasis:'latest_revision_published_within_window',financialOutcomeStatus:'not_evaluated'});
 }catch{return json({error:'register_unavailable'},503);}
}
