import {json,requireEntitledRole} from '../../_shared/util.js';
import {rollup} from '../../_shared/commercial-rollup.js';
export async function onRequestGet({request,env}){
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 const {results=[]}=await env.DB.prepare('SELECT l.*,c.supplier_id,COALESCE(l.reseller_id,c.reseller_id) AS effective_reseller,p.publisher_id,p.id AS product_id FROM commercial_purchase_lines l JOIN commercial_contracts c ON c.account_id=l.account_id AND c.id=l.contract_id JOIN commercial_skus s ON s.account_id=l.account_id AND s.id=l.sku_id JOIN commercial_products p ON p.account_id=s.account_id AND p.id=s.product_id WHERE l.account_id=? LIMIT 10001').bind(g.membership.account_id).all();
 if(results.length>10000)return json({error:'report_limit'},409);
 return json({basis:'annualized_recurring_catalogue_not_actual_spend',groups:rollup(results.map(l=>({...l,reseller_id:l.effective_reseller})))});
}
