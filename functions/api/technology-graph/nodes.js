import {json,requireEntitledRole} from '../../_shared/util.js';
const kinds=new Set(['objective','department','capability','product','contract','integration']);
export async function onRequestGet({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 const {results=[]}=await env.DB.prepare('SELECT id,kind,label,source_ref FROM technology_graph_nodes WHERE account_id=? ORDER BY id LIMIT 10001').bind(g.membership.account_id).all();
 if(results.length>10000)return json({error:'graph_limit'},409);
 return json({nodes:results});
}
export async function onRequestPost({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let b;try{const raw=await request.text();if(raw.length>8192)return json({error:'too_large'},413);b=JSON.parse(raw);if(!kinds.has(b.kind)||typeof b.label!=='string'||!b.label.trim()||b.label.length>240||typeof b.sourceRef!=='string'||!b.sourceRef.trim()||b.sourceRef.length>500)throw Error();}catch{return json({error:'invalid_node'},400);}
 const id=crypto.randomUUID();
 await env.DB.prepare('INSERT INTO technology_graph_nodes(account_id,id,kind,label,source_ref,created_at) VALUES(?,?,?,?,?,?)').bind(g.membership.account_id,id,b.kind,b.label.trim(),b.sourceRef.trim(),Date.now()).run();
 return json({id},201);
}
