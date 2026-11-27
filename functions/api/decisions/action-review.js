import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestPost({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let b;try{const raw=await request.text();if(raw.length>12000)return json({error:'too_large'},413);b=JSON.parse(raw);if(typeof b.id!=='string'||!['reviewed','dismissed'].includes(b.status)||typeof b.rationale!=='string'||!b.rationale.trim()||b.rationale.length>4000)throw Error();}catch{return json({error:'invalid_review'},400);}
 const row=await env.DB.prepare("INSERT INTO executive_action_events(account_id,action_id,id,from_status,to_status,actor_email,rationale,occurred_at) SELECT account_id,id,?,'open',?,?,?,? FROM executive_actions WHERE account_id=? AND id=? AND status='open' RETURNING id").bind(crypto.randomUUID(),b.status,g.user.email,b.rationale.trim(),Date.now(),g.membership.account_id,b.id).first();
 return row?json({id:b.id,status:b.status},201):json({error:'action_missing_or_already_reviewed'},409);
}
