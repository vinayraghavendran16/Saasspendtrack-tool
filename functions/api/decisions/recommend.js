import {json,requireEntitledRole} from '../../_shared/util.js';
import {orchestrateRecommendation} from '../../_shared/recommendation-orchestrator.js';
export async function onRequestPost({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let b;try{const raw=await request.text();if(raw.length>100000)return json({error:'too_large'},413);b=JSON.parse(raw);if(!b?.decision||!Array.isArray(b.plans))throw Error();}catch{return json({error:'invalid_request'},400);}
 const a=g.membership.account_id;
 const [n,e]=await env.DB.batch([env.DB.prepare('SELECT id,kind FROM technology_graph_nodes WHERE account_id=? LIMIT 10001').bind(a),env.DB.prepare('SELECT dependent_id AS dependentId,dependency_id AS dependencyId,criticality,evidence FROM technology_graph_edges WHERE account_id=? LIMIT 50001').bind(a)]);
 if(n.results.length>10000||e.results.length>50000)return json({error:'graph_limit'},409);
 // No verified outcome ingestion exists yet. Never trust caller-supplied history.
 try{return json(orchestrateRecommendation({decision:b.decision,plans:b.plans,graph:{nodes:n.results,edges:e.results},feedback:[]}));}catch{return json({error:'invalid_recommendation_inputs'},422);}
}
