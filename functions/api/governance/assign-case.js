import {json,requireEntitledRole,normalizeEmail} from '../../_shared/util.js';
export async function onRequestPost({request,env}){
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let b;try{b=await request.json()}catch{return json({error:'bad_json'},400)}
 if(typeof b?.id!=='string'||typeof b.ownerEmail!=='string'||!Number.isSafeInteger(b.version)||!Number.isSafeInteger(b.responseDueAt)||!Number.isSafeInteger(b.resolutionDueAt)||b.responseDueAt<=0||b.resolutionDueAt<b.responseDueAt)return json({error:'invalid_assignment'},400);
 const a=g.membership.account_id,email=normalizeEmail(b.ownerEmail),t=Date.now();
 const r=await env.DB.prepare("UPDATE vendor_cases SET owner_email=?,response_due_at=?,resolution_due_at=?,updated_at=?,version=version+1 WHERE account_id=? AND id=? AND version=? AND status NOT IN ('closed','resolved') AND EXISTS(SELECT 1 FROM memberships WHERE account_id=? AND email=? AND status='active') RETURNING version").bind(email,b.responseDueAt,b.resolutionDueAt,t,a,b.id,b.version,a,email).first();
 return r?json({version:r.version}):json({error:'conflict_or_invalid_member'},409);
}
