import {json,requireRole} from '../../_shared/util.js';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
export async function onRequestGet({request,env}){
 const gate=await requireRole(request,env,'admin');
 if(gate.response)return gate.response;
 const params=new URL(request.url).searchParams;
 const days=Number(params.get('days')||30);
 if(![7,30,90].includes(days))return json({error:'invalid_window'},400,headers);
 const since=Date.now()-days*86400000;
 const cursor=params.get('cursor');
 let before=Number.MAX_SAFE_INTEGER, beforeId='~';
 if(cursor){
 const match=/^(\d{1,16}):([a-f0-9-]{36})$/.exec(cursor);
 if(!match)return json({error:'invalid_cursor'},400,headers);
 before=Number(match[1]);beforeId=match[2];
 if(!Number.isSafeInteger(before)||before<0||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(beforeId))return json({error:'invalid_cursor'},400,headers);
 }
 try{
 const result=await env.DB.prepare('SELECT id,request_id,operation,outcome,occurred_at FROM ai_egress_audit WHERE account_id=? AND occurred_at>=? AND (occurred_at<? OR (occurred_at=? AND id<?)) ORDER BY occurred_at DESC,id DESC LIMIT 501').bind(gate.membership.account_id,since,before,before,beforeId).all();
 const rows=result.results||[];
 return json({days,since,provider:'Anthropic',records:rows.slice(0,500),truncated:rows.length>500,nextCursor:rows.length>500?String(rows[499].occurred_at)+':'+rows[499].id:null},200,headers);
 }catch(_){return json({error:'audit_unavailable'},503,headers);}
}
