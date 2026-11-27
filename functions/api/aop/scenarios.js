import {requireEntitledRole,json} from '../../_shared/util.js';
import {projectScenario} from '../../_shared/aop-scenario.js';
export async function onRequestGet({request,env}){
 if(env.AOP_ENABLED!=='true')return new Response(null,{status:404});
 const auth=await requireEntitledRole(request,env,'admin');if(auth instanceof Response)return auth;
 const {results}=await env.DB.prepare('SELECT id,name,fiscal_start,created_at FROM aop_scenarios WHERE account_id=? ORDER BY created_at DESC LIMIT 100').bind(auth.membership.account_id).all();
 return json({scenarios:results});
}
export async function onRequestPost({request,env}){
 if(env.AOP_ENABLED!=='true')return new Response(null,{status:404});
 const auth=await requireEntitledRole(request,env,'admin');if(auth instanceof Response)return auth;
 let b;try{const raw=await request.text();if(raw.length>200000)return json({error:'too_large'},413);b=JSON.parse(raw);if(typeof b.name!=='string'||!b.name.trim()||b.name.length>120||!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.fiscalStart)||!Array.isArray(b.assumptions?.months)||b.assumptions.months.length>12)throw Error();projectScenario(b.assumptions);}catch{return json({error:'invalid_scenario'},400);}
 const id=crypto.randomUUID(),t=Date.now(),account=auth.membership.account_id;
 await env.DB.batch([env.DB.prepare('INSERT INTO aop_scenarios(account_id,id,name,fiscal_start,created_at) VALUES(?,?,?,?,?)').bind(account,id,b.name.trim(),b.fiscalStart,t),env.DB.prepare('INSERT INTO aop_scenario_versions(account_id,scenario_id,revision,assumptions_json,created_at,created_by) VALUES(?,?,1,?,?,?)').bind(account,id,JSON.stringify(b.assumptions),t,auth.membership.email)]);
 return json({id,revision:1},201);
}
