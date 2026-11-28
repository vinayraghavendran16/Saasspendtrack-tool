import {json,getUserFromSession,getMembership,now,rateLimit} from '../../_shared/util.js';
import {inspectProviderLink} from '../../_shared/razorpay-recovery.js';
export async function onRequestPost({request,env}) {
 if(env.CHECKOUT_ISOLATED_SANDBOX!=='true'||env.CHECKOUT_PROVIDER_ENABLED!=='true'||env.CHECKOUT_RESERVATIONS_ENABLED!=='true') return json({error:'checkout_disabled'},503);
 if(request.headers.get('origin')!==new URL(request.url).origin) return json({error:'invalid_origin'},403);
 try {
  const u=await getUserFromSession(request,env);
  if(!u) return json({error:'sign_in_required'},401);
  const m=await getMembership(env,u.email);
  if(!m||m.role!=='owner'||m.status!=='active') return json({error:'owner_required'},403);
  const limit=await rateLimit(env,'checkout-recovery:'+m.account_id,10,3600000,{failClosed:true});
  if(!limit.ok) return json({error:'rate_limited'},limit.unavailable?503:429);
  let body;try{body=await request.json();}catch{return json({error:'invalid_json'},400);}
  if(!/^[a-f0-9]{32}$/.test(body?.checkoutId||'')) return json({error:'invalid_checkout'},400);
  const c=await env.DB.prepare("SELECT c.* FROM checkout_intents c JOIN accounts a ON a.id=c.account_id WHERE c.id=? AND c.account_id=? AND c.owner_email=? AND a.owner_email=c.owner_email AND c.status='created'").bind(body.checkoutId,m.account_id,u.email).first();
  if(!c) return json({error:'checkout_not_found'},404);
  const result=await inspectProviderLink(env,c);
  if(!result.terminalUnpaid) return json({error:'provider_not_terminal_unpaid'},409);
  await env.DB.batch([
   env.DB.prepare("INSERT INTO checkout_release_evidence(checkout_id,link_id,provider_status,amount_paid,verified_at) VALUES (?,?,?,?,?)").bind(c.id,c.link_id,result.status,0,now()),
   env.DB.prepare("UPDATE checkout_intents SET status=?,founding_slot=NULL WHERE id=?").bind(result.status,c.id)
  ]);
  return json({released:true,status:result.status});
 } catch{return json({error:'reconciliation_required'},503);}
}
