import {checkoutFailure} from '../../_shared/checkout-diagnostics.js';
import {json,getUserFromSession,getMembership,now,rateLimit} from '../../_shared/util.js';
import {discoverLostLink} from '../../_shared/razorpay-lost-link.js';
export async function onRequestPost({request,env}) {
 if(env.CHECKOUT_ISOLATED_SANDBOX!=='true'||env.CHECKOUT_PROVIDER_ENABLED!=='true'||env.CHECKOUT_RESERVATIONS_ENABLED!=='true') return json({error:'checkout_disabled'},503);
 if(request.headers.get('origin')!==new URL(request.url).origin) return json({error:'invalid_origin'},403);
 const correlationId=crypto.randomUUID();
 let stage='session';
 try {
  const u=await getUserFromSession(request,env);
  if(!u) return json({error:'sign_in_required'},401);
  stage='membership';
  const m=await getMembership(env,u.email);
  if(!m||m.role!=='owner'||m.status!=='active') return json({error:'owner_required'},403);
  stage='rate_limit';
  const limit=await rateLimit(env,'lost-checkout:'+m.account_id,5,3600000,{failClosed:true});
  if(!limit.ok) return json({error:'rate_limited'},limit.unavailable?503:429);
  stage='request';
  let body;try{body=await request.json();}catch{return json({error:'invalid_json'},400);}
  if(!/^[a-f0-9]{32}$/.test(body?.checkoutId||'')) return json({error:'invalid_checkout'},400);
  stage='checkout_lookup';
  const c=await env.DB.prepare("SELECT c.* FROM checkout_intents c JOIN accounts a ON a.id=c.account_id JOIN checkout_provider_claims p ON p.checkout_id=c.id WHERE c.id=? AND c.account_id=? AND c.owner_email=? AND a.owner_email=c.owner_email AND c.status='reserved' AND p.completed_at IS NULL AND p.claimed_at<=?").bind(body.checkoutId,m.account_id,u.email,now()-120000).first();
  if(!c) return json({error:'recovery_unavailable'},409);
  stage='provider_discovery';
  const link=await discoverLostLink(env,c);
  stage='database_persist';
  await env.DB.batch([
   env.DB.prepare("UPDATE checkout_intents SET status='created',link_id=? WHERE id=?").bind(link.linkId,c.id),
   env.DB.prepare("UPDATE checkout_provider_claims SET provider_url=?,completed_at=? WHERE checkout_id=?").bind(link.url,now(),c.id)
  ]);
  return json({recovered:true,correlationId,providerStatus:link.status,...(link.status==='created'&&c.expires_at>now()?{url:link.url}:c.expires_at<=now()?{diagnostic:'checkout_expired'}:{})});
 } catch(error) {
  return checkoutFailure('recover',stage,correlationId,error);
 }
}
