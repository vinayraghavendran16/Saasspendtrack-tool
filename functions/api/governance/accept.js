import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestPost({request,env}){
 const g=await requireEntitledRole(request,env);
 if(g.response)return g.response;
 let b;try{b=await request.json()}catch{return json({error:'bad_json'},400)}
 if(typeof b?.vendorId!=='string'||b.vendorId.length>200||!['business','finance','technical','backup','escalation'].includes(b.role)||!Number.isSafeInteger(b.assignedAt))return json({error:'invalid_assignment'},400);
 const row=await env.DB.prepare("UPDATE vendor_ownership SET accepted_at=? WHERE account_id=? AND vendor_id=? AND role=? AND member_email=? AND assigned_at=? AND accepted_at IS NULL AND EXISTS (SELECT 1 FROM memberships WHERE email=? AND account_id=? AND status='active') RETURNING accepted_at").bind(Date.now(),g.membership.account_id,b.vendorId,b.role,g.user.email,b.assignedAt,g.user.email,g.membership.account_id).first();
 return row?json({ok:true,acceptedAt:row.accepted_at}):json({error:'assignment_changed_or_already_accepted'},409);
}
