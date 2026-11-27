import {json,requireEntitledRole} from '../../_shared/util.js';
import {prioritizeActions} from '../../_shared/action-priority.js';
import {calendarDay} from '../../_shared/governance-deadlines.js';
const roles=['finance','it','procurement','revops','leadership'];
export async function onRequestGet({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 const role=new URL(request.url).searchParams.get('role');
 if(role&&!roles.includes(role))return json({error:'invalid_role'},400);
 const {results=[]}=await env.DB.prepare("SELECT id,decision_id AS decisionId,revision,alternative_id AS alternativeId,owner_role AS ownerRole,risk,evidence,deadline FROM executive_actions WHERE account_id=? AND status='open' AND (? IS NULL OR owner_role=?) LIMIT 1001").bind(g.membership.account_id,role,role).all();
 if(results.length>1000)return json({error:'queue_limit'},409);
 return json({actions:prioritizeActions(results,new Date().toISOString().slice(0,10))});
}
export async function onRequestPost({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let b;try{const raw=await request.text();if(raw.length>8192)return json({error:'too_large'},413);b=JSON.parse(raw);if(typeof b.decisionId!=='string'||!Number.isSafeInteger(b.revision)||b.revision<1||typeof b.alternativeId!=='string'||!roles.includes(b.ownerRole)||!['critical','high','medium','low'].includes(b.risk)||(b.deadline!=null&&calendarDay(b.deadline)===null))throw Error();}catch{return json({error:'invalid_action'},400);}
 const a=g.membership.account_id,id=crypto.randomUUID();
 const row=await env.DB.prepare("INSERT INTO executive_actions(account_id,id,decision_id,revision,alternative_id,owner_role,risk,evidence,deadline,created_by,created_at) SELECT v.account_id,?,v.decision_id,v.revision,?,?,?,json_extract(x.value,'$.evidence'),?,?,? FROM investment_decision_versions v,json_each(v.evaluation_json,'$.alternatives') x WHERE v.account_id=? AND v.decision_id=? AND v.revision=? AND json_extract(x.value,'$.id')=? ON CONFLICT DO NOTHING RETURNING id").bind(id,b.alternativeId,b.ownerRole,b.risk,b.deadline??null,g.user.email,Date.now(),a,b.decisionId,b.revision,b.alternativeId).first();
 return row?json({id:row.id},201):json({error:'missing_or_duplicate_action'},409);
}
