import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestGet({request,env}){
 const g=await requireEntitledRole(request,env,'admin');
 if(g.response)return g.response;
 const account=g.membership.account_id;
 const tables=['commercial_parties','commercial_party_roles','commercial_products','commercial_skus','commercial_contracts','commercial_purchase_lines'];
 const result=await env.DB.batch(tables.map(t=>env.DB.prepare('SELECT * FROM '+t+' WHERE account_id=? LIMIT 501').bind(account)));
 if(result.some(r=>r.results.length>500))return json({error:'catalogue_requires_pagination'},409);
 return json(Object.fromEntries(tables.map((t,i)=>[t,result[i].results])));
}
