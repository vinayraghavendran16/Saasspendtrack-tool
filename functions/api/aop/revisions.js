import {requireEntitledRole,json} from '../../_shared/util.js';
import {projectScenario} from '../../_shared/aop-scenario.js';
export async function onRequestGet({request,env}){
 if(env.AOP_ENABLED!=='true')return new Response(null,{status:404});
 const a=await requireEntitledRole(request,env,'admin');if(a.response)return a.response;
 const id=new URL(request.url).searchParams.get('id');
 const row=await env.DB.prepare('SELECT revision,assumptions_json,created_at FROM aop_scenario_versions WHERE account_id=? AND scenario_id=? ORDER BY revision DESC LIMIT 1').bind(a.membership.account_id,id).first();
 if(!row)return json({error:'not_found'},404);
 const assumptions=JSON.parse(row.assumptions_json);return json({revision:row.revision,assumptions,projection:projectScenario(assumptions)});
}
export async function onRequestPost({request,env}){
 if(env.AOP_ENABLED!=='true')return new Response(null,{status:404});
 const a=await requireEntitledRole(request,env,'admin');if(a.response)return a.response;
 let b;try{const raw=await request.text();if(raw.length>200000)return json({error:'too_large'},413);b=JSON.parse(raw);if(typeof b.id!=='string'||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<1||b.expectedRevision>=Number.MAX_SAFE_INTEGER||!Array.isArray(b.assumptions?.months)||b.assumptions.months.length>12)throw Error();projectScenario(b.assumptions);}catch{return json({error:'invalid_revision'},400);}
 const account=a.membership.account_id;
 const row=await env.DB.prepare('INSERT INTO aop_scenario_versions(account_id,scenario_id,revision,assumptions_json,created_at,created_by) SELECT ?,?,?,?,?,? WHERE (SELECT MAX(revision) FROM aop_scenario_versions WHERE account_id=? AND scenario_id=?)=? RETURNING revision').bind(account,b.id,b.expectedRevision+1,JSON.stringify(b.assumptions),Date.now(),a.membership.email,account,b.id,b.expectedRevision).first();
 return row?json(row,201):json({error:'revision_conflict'},409);
}
