import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestPost({request,env}){
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let b;try{b=await request.json()}catch{return json({error:'bad_json'},400)}
 const name=typeof b?.name==='string'?b.name.trim():'',account=g.membership.account_id,id=crypto.randomUUID();
 if(!name||name.length>240)return json({error:'invalid_name'},400);
 if(b.kind==='product'&&typeof b.publisherId==='string'){
 const r=await env.DB.prepare("INSERT INTO commercial_products(account_id,id,publisher_id,name) SELECT account_id,?,party_id,? FROM commercial_party_roles WHERE account_id=? AND party_id=? AND role='publisher' RETURNING id").bind(id,name,account,b.publisherId).first();
 return r?json({id},201):json({error:'publisher_not_found'},404);
 }
 if(b.kind==='sku'&&typeof b.productId==='string'&&['seat','credit','consumption','fixed'].includes(b.unit)){
 const r=await env.DB.prepare('INSERT INTO commercial_skus(account_id,id,product_id,name,unit) SELECT account_id,?,id,?,? FROM commercial_products WHERE account_id=? AND id=? RETURNING id').bind(id,name,b.unit,account,b.productId).first();
 return r?json({id},201):json({error:'product_not_found'},404);
 }
 return json({error:'invalid_kind'},400);
}
