import {json,requireEntitledRole,normalizeEmail,getAccountContext} from '../../_shared/util.js';
const roles=new Set(['business','finance','technical','backup','escalation']);
export async function onRequestGet({request,env}){
 const g=await requireEntitledRole(request,env);
 if(g.response)return g.response;
 const {results=[]}=await env.DB.prepare("SELECT o.*, CASE WHEN m.status='active' AND m.account_id=o.account_id THEN 1 ELSE 0 END AS eligible FROM vendor_ownership o LEFT JOIN memberships m ON m.email=o.member_email WHERE o.account_id=? ORDER BY o.vendor_id,o.role").bind(g.membership.account_id).all();
 return json({ownership:results});
}
export async function onRequestPost({request,env}){
 const g=await requireEntitledRole(request,env,'admin');
 if(g.response)return g.response;
 let b;try{b=await request.json()}catch{return json({error:'bad_json'},400)}
 const vendorId=b?.vendorId,role=b?.role,email=normalizeEmail(b?.memberEmail);
 if(typeof vendorId!=='string'||!vendorId.length||vendorId.length>200||!roles.has(role)||!email)return json({error:'invalid_assignment'},400);
 const account=g.membership.account_id;
 const ctx=await getAccountContext(env,g.user);
 if(!ctx||ctx.membership.account_id!==account)return json({error:'no_account'},403);
 const row=await env.DB.prepare('SELECT data FROM app_data WHERE email=?').bind(ctx.ownerEmail).first();
 let subscriptions;try{subscriptions=JSON.parse(row?.data||'{}').subscriptions}catch{return json({error:'invalid_saved_data'},503)}
 if(!Array.isArray(subscriptions)||!subscriptions.some(s=>s&&s.fromPreset!==true&&String(s.id)===vendorId))return json({error:'vendor_not_found'},404);
 const member=await env.DB.prepare("SELECT email FROM memberships WHERE account_id=? AND email=? AND status='active'").bind(account,email).first();
 if(!member)return json({error:'invalid_member'},422);
 const t=Date.now();
 await env.DB.batch([
 env.DB.prepare('INSERT INTO vendor_ownership(account_id,vendor_id,role,member_email,assigned_by,assigned_at) VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,vendor_id,role) DO UPDATE SET member_email=excluded.member_email,assigned_by=excluded.assigned_by,assigned_at=excluded.assigned_at,accepted_at=NULL').bind(account,vendorId,role,email,g.user.email,t),
 env.DB.prepare('INSERT INTO governance_audit(account_id,id,actor_email,kind,subject_id,detail,created_at) VALUES(?,?,?,?,?,?,?)').bind(account,crypto.randomUUID(),g.user.email,'ownership_assigned',vendorId,JSON.stringify({role,email}),t)
 ]);
 return json({ok:true});
}
