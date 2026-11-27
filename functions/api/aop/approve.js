import {requireEntitledRole,json} from '../../_shared/util.js';
export async function onRequestPost({request,env}){
 if(env.AOP_ENABLED!=='true')return new Response(null,{status:404});
 const a=await requireEntitledRole(request,env,'owner');if(a.response)return a.response;
 let b;try{const raw=await request.text();if(raw.length>4096)return json({error:'too_large'},413);b=JSON.parse(raw);if(typeof b.id!=='string'||!Number.isSafeInteger(b.revision)||b.revision<1)throw Error();}catch{return json({error:'invalid_approval'},400);}
 const account=a.membership.account_id;
 const row=await env.DB.prepare('INSERT INTO aop_approvals(account_id,scenario_id,revision,approved_by,approved_at) SELECT account_id,scenario_id,revision,?,? FROM aop_scenario_versions WHERE account_id=? AND scenario_id=? AND revision=? ON CONFLICT DO NOTHING RETURNING revision').bind(a.membership.email,Date.now(),account,b.id,b.revision).first();
 return row?json(row,201):json({error:'missing_or_already_approved'},409);
}
