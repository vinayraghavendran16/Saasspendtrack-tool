import {orchestrateRecommendation} from './recommendation-orchestrator.js';
// Use the server's workspace graph, never caller-provided dependency evidence/history.
export async function evaluateWorkspaceDecision(env,account,input){
 if(!input?.decision||!Array.isArray(input.plans))throw Error('action plans required');
 const [n,e]=await env.DB.batch([env.DB.prepare('SELECT id,kind FROM technology_graph_nodes WHERE account_id=? LIMIT 10001').bind(account),env.DB.prepare('SELECT dependent_id AS dependentId,dependency_id AS dependencyId,criticality,evidence FROM technology_graph_edges WHERE account_id=? LIMIT 50001').bind(account)]);
 if(n.results.length>10000||e.results.length>50000)throw Error('graph limit');
 return orchestrateRecommendation({decision:input.decision,plans:input.plans,graph:{nodes:n.results,edges:e.results},feedback:[]});
}
