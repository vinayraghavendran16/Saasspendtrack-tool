import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestPost({request,env}){
 if(env.PUPM_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 let b;try{
 const raw=await request.text();if(raw.length>4096)return json({error:'too_large'},413);
 b=JSON.parse(raw);
 if(!b||typeof b.observationId!=='string'||!b.observationId||b.observationId.length>128||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000||Object.hasOwn(b,'accountId'))throw Error();
 }catch{return json({error:'invalid_selection'},400);}
 const a=g.membership.account_id,id=crypto.randomUUID();
 try{
 const saved=await env.DB.prepare("INSERT INTO pupm_source_selections(account_id,id,observation_id,selected_by,reason,selected_at) SELECT account_id,?,id,?,?,? FROM pupm_population_observations WHERE account_id=? AND id=? AND scope_type='organization' AND scope_id=? AND denominator='employees' RETURNING id").bind(id,g.user.email,b.reason.trim(),Date.now(),a,b.observationId,a).first();
 return saved?json({id,status:'owner_selected'},201):json({error:'observation_not_found'},404);
 }catch{return json({error:'selection_conflict'},409);}
}
