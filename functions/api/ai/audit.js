import {json,requireRole} from '../../_shared/util.js';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
export async function onRequestGet({request,env}){
 const gate=await requireRole(request,env,'admin');
 if(gate.response)return gate.response;
 const params=new URL(request.url).searchParams;
 const days=Number(params.get('days')||30);
 if(![7,30,90].includes(days))return json({error:'invalid_window'},400,headers);
 const since=Date.now()-days*86400000;
 try{
 const result=await env.DB.prepare('SELECT id,request_id,operation,outcome,occurred_at FROM ai_egress_audit WHERE account_id=? AND occurred_at>=? ORDER BY occurred_at DESC,id DESC LIMIT 501').bind(gate.membership.account_id,since).all();
 const rows=result.results||[];
 return json({days,since,provider:'Anthropic',records:rows.slice(0,500),truncated:rows.length>500},200,headers);
 }catch(_){return json({error:'audit_unavailable'},503,headers);}
}
