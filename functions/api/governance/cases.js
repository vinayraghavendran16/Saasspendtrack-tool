import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestGet({request,env}){
 const g=await requireEntitledRole(request,env,'admin');
 if(g.response)return g.response;
 const url=new URL(request.url),status=url.searchParams.get('status');
 const allowed=['open','awaiting_vendor','awaiting_internal','resolved','closed'];
 if(status&&!allowed.includes(status))return json({error:'invalid_status'},400);
 const account=g.membership.account_id;
 const q=env.DB.prepare('SELECT * FROM vendor_cases WHERE account_id=? AND (? IS NULL OR status=?) ORDER BY updated_at DESC,id LIMIT 501');
 const {results=[]}=await q.bind(account,status,status).all();
 if(results.length>500)return json({error:'cases_require_pagination'},409);
 return json({cases:results});
}
