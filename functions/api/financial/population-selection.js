import {json,requireEntitledRole} from '../../_shared/util.js';
import {auditStatement} from '../../_shared/platform-audit.js';
export async function onRequestPost({request,env}){
 if(env.PUPM_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 let b;try{
 const raw=await request.text();if(raw.length>4096)return json({error:'too_large'},413);
 b=JSON.parse(raw);
 if(!b||typeof b.observationId!=='string'||!b.observationId||b.observationId.length>128||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000||Object.hasOwn(b,'accountId'))throw Error();
 }catch{return json({error:'invalid_selection'},400);}
 const a=g.membership.account_id,id=crypto.randomUUID();
 try{
 const write=env.DB.prepare("INSERT INTO pupm_source_selections(account_id,id,observation_id,selected_by,reason,selected_at) SELECT account_id,?,id,?,?,? FROM pupm_population_observations WHERE account_id=? AND id=? AND scope_type='organization' AND scope_id=? AND denominator='employees' RETURNING id").bind(id,g.user.email,b.reason.trim(),Date.now(),a,b.observationId,a);
 let saved;
 if(env.PLATFORM_AUDIT_ENABLED==='true'){
 // Guard the audit insert with the newly inserted selection, not a preflight read.
 const guarded={prepare(sql){return env.DB.prepare(sql.replace('VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)','SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,1 WHERE EXISTS(SELECT 1 FROM pupm_source_selections WHERE account_id=? AND id=?)'));}};
 const db={prepare(sql){const stmt=guarded.prepare(sql);return {bind(...args){return stmt.bind(...args,a,id);}};}};
 const audit=auditStatement(db,{accountId:a,actorId:g.user.email,actorType:'user',mode:'api',correlationId:id},{action:'select',entityType:'population_source_selection',entityId:id,outcome:'committed',changedFields:['observationId']},['observationId']);
 const results=await env.DB.batch([write,audit]);saved=results[0].results[0];
 }else saved=await write.first();
 return saved?json({id,status:'owner_selected'},201):json({error:'observation_not_found'},404);
 }catch{return json({error:'selection_conflict'},409);}
}
