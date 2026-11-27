import {json,requireEntitledRole} from '../../_shared/util.js';
import {evaluateWorkspaceDecision} from '../../_shared/decision-review-context.js';
export async function onRequestPost({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let b;try{const raw=await request.text();if(raw.length>100000)return json({error:'too_large'},413);b=JSON.parse(raw);if(!b?.decision||!Array.isArray(b.plans))throw Error();}catch{return json({error:'invalid_request'},400);}
 const a=g.membership.account_id;
 try{return json(await evaluateWorkspaceDecision(env,a,b));}catch{return json({error:'invalid_recommendation_inputs'},422);}
}
