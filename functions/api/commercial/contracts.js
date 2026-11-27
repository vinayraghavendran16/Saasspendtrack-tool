import {json,requireEntitledRole} from '../../_shared/util.js';
import {calendarDay} from '../../_shared/governance-deadlines.js';
export async function onRequestPost({request,env}){
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let b;try{b=await request.json()}catch{return json({error:'bad_json'},400)}
 if(typeof b?.supplierId!=='string'||(b.resellerId!=null&&typeof b.resellerId!=='string'))return json({error:'invalid_party'},400);
 const start=calendarDay(b.startDate),end=calendarDay(b.endDate),notice=b.noticeDate==null?null:calendarDay(b.noticeDate);
 if(start===null||end===null||end<start||(b.noticeDate!=null&&(notice===null||notice>end)))return json({error:'invalid_dates'},400);
 const a=g.membership.account_id,id=crypto.randomUUID(),reseller=b.resellerId??null;
 const r=await env.DB.prepare("INSERT INTO commercial_contracts(account_id,id,supplier_id,reseller_id,reference,start_date,end_date,notice_date) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM commercial_party_roles WHERE account_id=? AND party_id=? AND role='supplier') AND (? IS NULL OR EXISTS(SELECT 1 FROM commercial_party_roles WHERE account_id=? AND party_id=? AND role='reseller')) RETURNING id").bind(a,id,b.supplierId,reseller,typeof b.reference==='string'?b.reference.slice(0,240):null,b.startDate,b.endDate,b.noticeDate??null,a,b.supplierId,reseller,a,reseller).first();
 return r?json({id},201):json({error:'invalid_party_role'},422);
}
