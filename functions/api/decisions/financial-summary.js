import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestGet({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 const url=new URL(request.url),after=url.searchParams.get('after')||'',revisionRaw=url.searchParams.get('revision')||'0',revision=Number(revisionRaw);
 if(after.length>512||!/^\d+$/.test(revisionRaw)||!Number.isSafeInteger(revision)||revision<0||(!after&&revision!==0))return json({error:'invalid_cursor'},400);
 const {results=[]}=await env.DB.prepare(`SELECT r.decision_id,r.revision,r.contract_id,r.period_start,r.period_end,r.result_json,r.reviewed_at,
 a.evidence_digest,a.attested_at,
 (SELECT count(*) FROM decision_financial_fact_allocations f WHERE f.account_id=r.account_id AND f.decision_id=r.decision_id AND f.revision=r.revision) AS allocated_count,
 json_array_length(r.evidence_json) AS evidence_count
 FROM decision_financial_reviews r LEFT JOIN decision_financial_attestations a ON a.account_id=r.account_id AND a.decision_id=r.decision_id AND a.revision=r.revision
 WHERE r.account_id=? AND (r.decision_id>? OR (r.decision_id=? AND r.revision>?)) ORDER BY r.decision_id,r.revision LIMIT 101`).bind(g.membership.account_id,after,after,revision).all();
 // Never aggregate different currencies or multiple revisions into a savings total.
 // Composite cursor preserves all revisions at page boundaries.
 return json({reviews:results.slice(0,100).map(r=>({decisionId:r.decision_id,revision:r.revision,contractId:r.contract_id,periodStart:r.period_start,periodEnd:r.period_end,result:JSON.parse(r.result_json),reviewedAt:r.reviewed_at,attestedAt:r.attested_at,evidenceDigest:r.evidence_digest,evidenceCount:r.evidence_count,allocatedCount:r.allocated_count,status:r.attested_at&&r.evidence_count>0&&r.allocated_count===r.evidence_count?'attested':'reconciled',learningEligible:false})),nextCursor:results.length>100?{after:results[99].decision_id,revision:results[99].revision}:null,truncated:results.length>100});
}
