import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestPost({request,env}){
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let b;try{b=await request.json()}catch{return json({error:'bad_json'},400)}
 if(typeof b?.contractId!=='string'||typeof b.skuId!=='string'||typeof b.quantity!=='string'||!/^\d{1,9}(\.\d{1,6})?$/.test(b.quantity)||Number(b.quantity)<=0||!Number.isSafeInteger(b.unitPriceMinor)||b.unitPriceMinor<0||typeof b.currency!=='string'||! /^[A-Z]{3}$/.test(b.currency)||!['monthly','annual','one_time','usage','custom'].includes(b.billingPeriod))return json({error:'invalid_line'},400);
 const a=g.membership.account_id,id=crypto.randomUUID(),reseller=b.resellerId??null;
 if(reseller!==null&&typeof reseller!=='string')return json({error:'invalid_reseller'},400);
 const r=await env.DB.prepare("INSERT INTO commercial_purchase_lines(account_id,id,contract_id,sku_id,reseller_id,quantity_decimal,unit_price_minor,currency,billing_period) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM commercial_contracts WHERE account_id=? AND id=?) AND EXISTS(SELECT 1 FROM commercial_skus WHERE account_id=? AND id=? AND (unit<>'seat' OR ?=1)) AND (? IS NULL OR EXISTS(SELECT 1 FROM commercial_party_roles WHERE account_id=? AND party_id=? AND role='reseller')) RETURNING id").bind(a,id,b.contractId,b.skuId,reseller,b.quantity,b.unitPriceMinor,b.currency,b.billingPeriod,a,b.contractId,a,b.skuId,Number.isInteger(Number(b.quantity))?1:0,reseller,a,reseller).first();
 return r?json({id},201):json({error:'invalid_relationship'},422);
}
