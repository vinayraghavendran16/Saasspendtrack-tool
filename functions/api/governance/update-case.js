import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestPost({request,env}){
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let b;try{b=await request.json()}catch{return json({error:'bad_json'},400)}
 const transitions={open:['awaiting_vendor','awaiting_internal','resolved'],awaiting_vendor:['open','awaiting_internal','resolved'],awaiting_internal:['open','awaiting_vendor','resolved'],resolved:['open','closed'],closed:[]};
 if(typeof b?.id!=='string'||!Number.isSafeInteger(b.version)||!Object.hasOwn(transitions,b.status))return json({error:'invalid_update'},400);
 const a=g.membership.account_id;
 const current=await env.DB.prepare('SELECT status,version FROM vendor_cases WHERE account_id=? AND id=?').bind(a,b.id).first();
 if(!current)return json({error:'not_found'},404);
 if(current.version!==b.version||!transitions[current.status].includes(b.status))return json({error:'conflict'},409);
 const r=await env.DB.prepare('UPDATE vendor_cases SET status=?,version=version+1,updated_at=? WHERE account_id=? AND id=? AND version=? RETURNING version').bind(b.status,Date.now(),a,b.id,b.version).first();
 return r?json({version:r.version,status:b.status}):json({error:'conflict'},409);
}
