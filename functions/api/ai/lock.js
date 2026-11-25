import {json,requireRole,now} from '../../_shared/util.js';
const headers={'Cache-Control':'private, no-store'};
export async function onRequestPost({request,env}){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'invalid_origin'},403,headers);
 const gate=await requireRole(request,env,'owner');
 if(gate.response)return gate.response;
 const body=await request.json().catch(()=>null);
 if(typeof body?.locked!=='boolean')return json({error:'invalid_lock'},400,headers);
 const id=gate.membership.account_id,t=now(),locked=body.locked?1:0;
 try{
 const statements=[
 env.DB.prepare('INSERT INTO workspace_ai_locks(account_id,locked,changed_at) VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET locked=excluded.locked,changed_at=excluded.changed_at').bind(id,locked,t),
 env.DB.prepare('INSERT INTO workspace_ai_lock_events(id,account_id,actor_email,locked,changed_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,gate.user.email,locked,t)
 ];
 if(locked)statements.push(env.DB.prepare('UPDATE workspace_ai_settings SET enabled=0,changed_by=?,changed_at=? WHERE account_id=?').bind(gate.user.email,t,id));
 await env.DB.batch(statements);
 return json({locked:body.locked},200,headers);
 }catch(_){return json({error:'lock_update_failed'},503,headers);}
}
