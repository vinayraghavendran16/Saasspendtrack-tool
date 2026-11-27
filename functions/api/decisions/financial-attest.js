import {json,requireEntitledRole,sha256Hex} from '../../_shared/util.js';
import {financialLearningEligibility} from '../../_shared/financial-learning-eligibility.js';
export async function onRequestPost({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 let b;try{const raw=await request.text();if(raw.length>4096)return json({error:'too_large'},413);b=JSON.parse(raw);if(typeof b.id!=='string'||!b.id||b.id.length>128||!Number.isSafeInteger(b.revision)||b.revision<1||b.baselineApproved!==true||b.periodComplete!==true||b.attributionVerified!==true)throw Error();}catch{return json({error:'invalid_attestation'},400);}
 const a=g.membership.account_id;
 const row=await env.DB.prepare('SELECT result_json,evidence_json FROM decision_financial_reviews WHERE account_id=? AND decision_id=? AND revision=?').bind(a,b.id,b.revision).first();
 if(!row)return json({error:'review_required'},404);
 let review,evidence;try{review=JSON.parse(row.result_json);evidence=JSON.parse(row.evidence_json);if(!Array.isArray(evidence)||!evidence.length||evidence.length>10000||new Set(evidence.map(x=>x.id)).size!==evidence.length)throw Error();}catch{return json({error:'invalid_saved_evidence'},422);}
 const digest=await sha256Hex(JSON.stringify([a,b.id,b.revision,row.result_json,row.evidence_json]));
 const policy=financialLearningEligibility({review,attestation:{baselineApproved:true,periodComplete:true,attributionVerified:true,exclusiveEvidenceAllocation:true,reviewerId:g.user.email,evidenceDigest:digest}});
 if(!policy.eligible)return json({error:'ineligible',reasons:policy.reasons},422);
 // Compare every snapshot field against the current ledger inside the write transaction.
 // A missing or changed fact deliberately produces a NULL fact_id, aborting the batch.
 // D1 batch is atomic; uniqueness or scope violations roll back both statements.
 // The allocation SELECT enumerates every saved evidence row; foreign keys reject missing facts.
 try{
 await env.DB.batch([
 env.DB.prepare('INSERT INTO decision_financial_attestations(account_id,decision_id,revision,reviewer_id,evidence_digest,baseline_approved,period_complete,attribution_verified,attested_at) VALUES(?,?,?,?,?,1,1,1,?)').bind(a,b.id,b.revision,g.user.email,digest,Date.now()),
 env.DB.prepare("INSERT INTO decision_financial_fact_allocations(account_id,fact_id,decision_id,revision) SELECT r.account_id,f.id,r.decision_id,r.revision FROM decision_financial_reviews r JOIN json_each(r.evidence_json) e LEFT JOIN reporting_financial_facts f ON f.account_id=r.account_id AND f.id=json_extract(e.value,'$.id') AND f.contract_id=json_extract(e.value,'$.contract_id') AND f.source_id=json_extract(e.value,'$.source_id') AND f.source_record_id=json_extract(e.value,'$.source_record_id') AND f.kind=json_extract(e.value,'$.kind') AND f.effective_date=json_extract(e.value,'$.effective_date') AND f.currency=json_extract(e.value,'$.currency') AND f.amount_minor=json_extract(e.value,'$.amount_minor') WHERE r.account_id=? AND r.decision_id=? AND r.revision=?").bind(a,b.id,b.revision)
 ]);
 }catch(err){console.warn('Financial attestation transaction rejected');return json({error:'attestation_conflict_or_unavailable'},409);}
 return json({status:'attested',evidenceDigest:digest,learningEligible:false},201);
}
