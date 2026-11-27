import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestPost({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 let b;try{const raw=await request.text();if(raw.length>16000)return json({error:'too_large'},413);b=JSON.parse(raw);if(typeof b.id!=='string'||!Number.isSafeInteger(b.revision)||b.revision<1||!['met','unmet','unknown'].includes(b.outcome)||typeof b.evidenceRef!=='string'||!b.evidenceRef.trim()||b.evidenceRef.length>500||typeof b.notes!=='string'||b.notes.length>4000)throw Error();}catch{return json({error:'invalid_outcome'},400);}
 const a=g.membership.account_id,id=crypto.randomUUID();
 const row=await env.DB.prepare("INSERT INTO investment_decision_outcomes(account_id,decision_id,revision,id,selected_alternative_id,outcome_json,evidence_ref,recorded_by,recorded_at) SELECT account_id,decision_id,revision,?,selected_alternative_id,?,?,?,? FROM investment_decision_approvals WHERE account_id=? AND decision_id=? AND revision=? AND NOT EXISTS(SELECT 1 FROM investment_decision_outcomes WHERE account_id=? AND decision_id=? AND revision=?) RETURNING id").bind(id,JSON.stringify({outcome:b.outcome,notes:b.notes,evidence:'owner_attested'}),b.evidenceRef.trim(),g.user.email,Date.now(),a,b.id,b.revision,a,b.id,b.revision).first();
 return row?json({id:row.id,status:'owner_attested'},201):json({error:'approval_missing_or_outcome_exists'},409);
}
