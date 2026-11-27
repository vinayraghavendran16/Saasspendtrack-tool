import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestGet({request,env}){
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 const t=Date.now();
 const {results=[]}=await env.DB.prepare("SELECT id,vendor_id,title,severity,status,owner_email,response_due_at,resolution_due_at,CASE WHEN resolution_due_at<=? THEN 1 ELSE 0 END AS resolution_overdue FROM vendor_cases WHERE account_id=? AND status NOT IN ('resolved','closed') AND resolution_due_at<=? ORDER BY resolution_due_at,id LIMIT 501").bind(t,g.membership.account_id,t).all();
 return json({cases:results.slice(0,500),truncated:results.length>500,asOf:t});
}
