import {json,requireEntitledRole} from '../../_shared/util.js';
import {validateObservation} from '../../_shared/pupm-observation.js';
import {auditStatement} from '../../_shared/platform-audit.js';
const enabled=env=>env.PUPM_ENABLED==='true';
export async function onRequestPost({request,env}){
 if(!enabled(env))return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 const account=g.membership.account_id;
 let b,r;try{
 const raw=await request.text();if(raw.length>4096)return json({error:'too_large'},413);
 b=JSON.parse(raw);
 if(!b||Object.hasOwn(b,'accountId')||Object.hasOwn(b,'scope')||Object.hasOwn(b,'scopeId')||Object.hasOwn(b,'scopeType'))throw Error();
 if(b.supersedesId!=null&&(typeof b.supersedesId!=='string'||!b.supersedesId||b.supersedesId.length>128))throw Error();
 r=validateObservation({...b,accountId:account,scope:account,recordedAt:Date.now()},account);
 }catch{return json({error:'invalid_observation'},400);}
 const id=crypto.randomUUID();
 try{
 const write=env.DB.prepare("INSERT INTO pupm_population_observations(account_id,id,scope_type,scope_id,month,denominator,population,active_window_days,source_id,source_record_id,recorded_at,supersedes_id) VALUES(?,?,'organization',?,?,?,?,?,?,?,?,?) RETURNING id").bind(account,id,account,r.month,r.denominator,r.count,r.activeWindowDays,r.sourceId,r.sourceRecordId,r.recordedAt,b.supersedesId??null);
 let saved;
 if(env.PLATFORM_AUDIT_ENABLED==='true'){
 const audit=auditStatement(env.DB,{accountId:account,actorId:g.user.email,actorType:'user',mode:'api',correlationId:id},{action:b.supersedesId?'correct':'create',entityType:'population_observation',entityId:id,outcome:'committed',changedFields:['population','denominator','month']},['population','denominator','month']);
 const results=await env.DB.batch([write,audit]);saved=results[0].results[0];
 }else saved=await write.first();
 return json({id:saved.id,status:'recorded',sourceTrust:'owner_reported'},201);
 }catch{return json({error:'observation_write_failed'},409);}
}
export async function onRequestGet({request,env}){
 if(!enabled(env))return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 const account=g.membership.account_id,u=new URL(request.url),month=u.searchParams.get('month');
 if(!month||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return json({error:'invalid_month'},400);
 const {results=[]}=await env.DB.prepare("SELECT p.id,p.month,p.denominator,p.population,p.active_window_days,p.source_id,p.source_record_id,p.recorded_at FROM pupm_population_observations p WHERE p.account_id=? AND p.scope_type='organization' AND p.scope_id=? AND p.month=? AND NOT EXISTS(SELECT 1 FROM pupm_population_observations n WHERE n.account_id=p.account_id AND n.supersedes_id=p.id) ORDER BY p.denominator,p.id LIMIT 501").bind(account,account,month).all();
 if(results.length>500)return json({error:'too_many_observations'},422);
 return json({observations:results,sourceTrust:'owner_reported',aggregation:'not_performed'});
}
