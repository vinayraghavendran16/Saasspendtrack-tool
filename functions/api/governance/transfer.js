import {json,requireEntitledRole,normalizeEmail} from '../../_shared/util.js';
export async function onRequestPost({request,env}){
 const g=await requireEntitledRole(request,env,'admin');
 if(g.response)return g.response;
 let b;try{b=await request.json()}catch{return json({error:'bad_json'},400)}
 if(typeof b?.fromEmail!=='string'||typeof b?.toEmail!=='string')return json({error:'invalid_transfer'},400);
 const from=normalizeEmail(b.fromEmail),to=normalizeEmail(b.toEmail),account=g.membership.account_id;
 if(!from||!to||from===to||b.confirmed!==true)return json({error:'invalid_transfer'},400);
 const source=await env.DB.prepare('SELECT email FROM memberships WHERE account_id=? AND email=?').bind(account,from).first();
 const target=await env.DB.prepare("SELECT email FROM memberships WHERE account_id=? AND email=? AND status='active'").bind(account,to).first();
 if(!source||!target)return json({error:'invalid_member'},422);
 const t=Date.now();
 const result=await env.DB.batch([
 env.DB.prepare("UPDATE vendor_ownership SET member_email=?,assigned_by=?,assigned_at=?,accepted_at=NULL WHERE account_id=? AND member_email=?").bind(to,g.user.email,t,account,from),
 env.DB.prepare("UPDATE vendor_cases SET owner_email=?,updated_at=?,version=version+1 WHERE account_id=? AND owner_email=? AND status NOT IN ('resolved','closed')").bind(to,t,account,from),
 env.DB.prepare("UPDATE governance_notifications SET status='cancelled' WHERE account_id=? AND recipient_email=? AND status='pending'").bind(account,from),
 env.DB.prepare('INSERT INTO governance_audit(account_id,id,actor_email,kind,subject_id,detail,created_at) VALUES(?,?,?,?,?,?,?)').bind(account,crypto.randomUUID(),g.user.email,'responsibility_transferred',from,JSON.stringify({from,to}),t)
 ]);
 return json({ok:true,assignments:result[0].meta?.changes??null,cases:result[1].meta?.changes??null,cancelledNotifications:result[2].meta?.changes??null});
}
