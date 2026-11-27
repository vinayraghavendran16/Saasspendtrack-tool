import {json,requireEntitledRole} from '../../_shared/util.js';
import {evaluateWorkspaceDecision} from '../../_shared/decision-review-context.js';
export async function onRequestGet({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 const id=new URL(request.url).searchParams.get('id');
 if(!id||id.length>100)return json({error:'invalid_id'},400);
 const rows=await env.DB.prepare('SELECT revision,evaluation_json,created_at FROM investment_decision_versions WHERE account_id=? AND decision_id=? ORDER BY revision DESC LIMIT 51').bind(g.membership.account_id,id).all();
 if(!rows.results.length)return json({error:'not_found'},404);
 return json({versions:rows.results.slice(0,50).map(r=>({revision:r.revision,evaluation:JSON.parse(r.evaluation_json),createdAt:r.created_at})),truncated:rows.results.length>50});
}
export async function onRequestPost({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let b,evaluation;try{const raw=await request.text();if(raw.length>100000)return json({error:'too_large'},413);b=JSON.parse(raw);if(typeof b.id!=='string'||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<1||b.expectedRevision>=Number.MAX_SAFE_INTEGER)throw Error();evaluation=await evaluateWorkspaceDecision(env,g.membership.account_id,b.inputs);}catch{return json({error:'invalid_revision'},400);}
 const a=g.membership.account_id;
 const row=await env.DB.prepare('INSERT INTO investment_decision_versions(account_id,decision_id,revision,inputs_json,evaluation_json,created_by,created_at) SELECT d.account_id,d.id,?,?,?,?,? FROM investment_decisions d WHERE d.account_id=? AND d.id=? AND d.scope_key=? AND d.objective=? AND (SELECT MAX(revision) FROM investment_decision_versions WHERE account_id=d.account_id AND decision_id=d.id)=? RETURNING revision').bind(b.expectedRevision+1,JSON.stringify(b.inputs),JSON.stringify(evaluation),g.user.email,Date.now(),a,b.id,evaluation.scopeKey,evaluation.objective,b.expectedRevision).first();
 return row?json({revision:row.revision,evaluation},201):json({error:'revision_conflict_or_scope_changed'},409);
}
