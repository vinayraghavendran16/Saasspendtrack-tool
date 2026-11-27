import {json,requireEntitledRole} from '../../_shared/util.js';
import {evaluateWorkspaceDecision} from '../../_shared/decision-review-context.js';
export async function onRequestPost({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 let b;try{const raw=await request.text();if(raw.length>12000)return json({error:'too_large'},413);b=JSON.parse(raw);if(typeof b.id!=='string'||!Number.isSafeInteger(b.revision)||b.revision<1||typeof b.alternativeId!=='string'||typeof b.rationale!=='string'||!b.rationale.trim()||b.rationale.length>4000)throw Error();}catch{return json({error:'invalid_approval'},400);}
 const a=g.membership.account_id;
 const saved=await env.DB.prepare('SELECT inputs_json FROM investment_decision_versions WHERE account_id=? AND decision_id=? AND revision=?').bind(a,b.id,b.revision).first();
 if(!saved)return json({error:'missing_decision'},404);
 let fresh;try{fresh=await evaluateWorkspaceDecision(env,a,JSON.parse(saved.inputs_json));}catch{return json({error:'decision_revalidation_failed'},409);}
 if(!fresh.alternatives.some(x=>x.id===b.alternativeId&&x.eligible===true))return json({error:'dependency_or_evidence_review_required'},409);
 const row=await env.DB.prepare("INSERT INTO investment_decision_approvals(account_id,decision_id,revision,selected_alternative_id,approved_by,approved_at,rationale) SELECT v.account_id,v.decision_id,v.revision,?,?,?,? FROM investment_decision_versions v WHERE v.account_id=? AND v.decision_id=? AND v.revision=? AND v.revision=(SELECT MAX(revision) FROM investment_decision_versions WHERE account_id=v.account_id AND decision_id=v.decision_id) AND EXISTS(SELECT 1 FROM json_each(v.evaluation_json,'$.alternatives') x WHERE json_extract(x.value,'$.id')=? AND json_extract(x.value,'$.eligible')=1) ON CONFLICT DO NOTHING RETURNING revision").bind(b.alternativeId,g.user.email,Date.now(),b.rationale.trim(),a,b.id,b.revision,b.alternativeId).first();
 return row?json({revision:row.revision,alternativeId:b.alternativeId},201):json({error:'ineligible_stale_or_already_approved'},409);
}
