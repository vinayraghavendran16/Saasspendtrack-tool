import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestPost({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let b;try{const raw=await request.text();if(raw.length>8192)return json({error:'too_large'},413);b=JSON.parse(raw);if(typeof b.dependentId!=='string'||typeof b.dependencyId!=='string'||b.dependentId===b.dependencyId||!['critical','high','medium','low'].includes(b.criticality)||typeof b.sourceRef!=='string'||!b.sourceRef.trim()||b.sourceRef.length>500)throw Error();}catch{return json({error:'invalid_edge'},400);}
 const a=g.membership.account_id,id=crypto.randomUUID();
 const row=await env.DB.prepare("INSERT INTO technology_graph_edges(account_id,id,dependent_id,dependency_id,criticality,evidence,source_ref,created_at) SELECT ?,?,?,?,?,'asserted',?,? WHERE EXISTS(SELECT 1 FROM technology_graph_nodes WHERE account_id=? AND id=?) AND EXISTS(SELECT 1 FROM technology_graph_nodes WHERE account_id=? AND id=?) ON CONFLICT DO NOTHING RETURNING id").bind(a,id,b.dependentId,b.dependencyId,b.criticality,b.sourceRef.trim(),Date.now(),a,b.dependentId,a,b.dependencyId).first();
 return row?json({id:row.id,evidence:'asserted'},201):json({error:'invalid_or_duplicate_dependency'},409);
}
