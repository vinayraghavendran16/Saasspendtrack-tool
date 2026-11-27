import {json,requireEntitledRole,getAccountContext} from '../../_shared/util.js';
export async function onRequestPost({request,env}){
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let b;try{b=await request.json()}catch{return json({error:'bad_json'},400)}
 const title=typeof b?.title==='string'?b.title.trim():'';
 if(!title||title.length>240||typeof b.vendorId!=='string'||!['inbound','outbound'].includes(b.direction)||!['low','medium','high','critical'].includes(b.severity))return json({error:'invalid_case'},400);
 const account=g.membership.account_id,ctx=await getAccountContext(env,g.user);
 if(!ctx||ctx.membership.account_id!==account)return json({error:'no_account'},403);
 const row=await env.DB.prepare('SELECT data FROM app_data WHERE email=?').bind(ctx.ownerEmail).first();
 let subs;try{subs=JSON.parse(row?.data||'{}').subscriptions}catch{return json({error:'invalid_saved_data'},503)}
 if(!Array.isArray(subs)||!subs.some(s=>s&&s.fromPreset!==true&&String(s.id)===b.vendorId))return json({error:'vendor_not_found'},404);
 const id=crypto.randomUUID(),t=Date.now();
 await env.DB.batch([env.DB.prepare('INSERT INTO vendor_cases(account_id,id,vendor_id,direction,severity,status,title,owner_email,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(account,id,b.vendorId,b.direction,b.severity,'open',g.user.email,g.user.email,t,t),env.DB.prepare('INSERT INTO vendor_case_events(account_id,case_id,id,actor_email,kind,detail,created_at) VALUES(?,?,?,?,?,?,?)').bind(account,id,crypto.randomUUID(),g.user.email,'created','{}',t)]);
 return json({id,status:'open'},201);
}
