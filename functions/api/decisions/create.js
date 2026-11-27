import {json,requireEntitledRole} from '../../_shared/util.js';
import {evaluateWorkspaceDecision} from '../../_shared/decision-review-context.js';
export async function onRequestPost({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let inputs,evaluation;try{const raw=await request.text();if(raw.length>100000)return json({error:'too_large'},413);inputs=JSON.parse(raw);evaluation=await evaluateWorkspaceDecision(env,g.membership.account_id,inputs);}catch{return json({error:'invalid_decision'},400);}
 const a=g.membership.account_id,id=crypto.randomUUID(),t=Date.now();
 await env.DB.batch([
 env.DB.prepare('INSERT INTO investment_decisions(account_id,id,scope_key,objective,created_by,created_at) VALUES(?,?,?,?,?,?)').bind(a,id,evaluation.scopeKey,evaluation.objective,g.user.email,t),
 env.DB.prepare('INSERT INTO investment_decision_versions(account_id,decision_id,revision,inputs_json,evaluation_json,created_by,created_at) VALUES(?,?,1,?,?,?,?)').bind(a,id,JSON.stringify(inputs),JSON.stringify(evaluation),g.user.email,t)]);
 return json({id,revision:1,evaluation},201);
}
