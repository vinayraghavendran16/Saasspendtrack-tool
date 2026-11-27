import {json,getUserFromSession,getMembership,now,rateLimit} from '../../_shared/util.js';
import {discoverLostLink} from '../../_shared/razorpay-lost-link.js';
const DISCOVERY_ERRORS=new Map([
 ['provider_disabled',['checkout_disabled',503]],
 ['provider_lookup_unavailable',['provider_lookup_unavailable',503]],
 ['provider_response_invalid',['provider_response_invalid',502]],
 ['provider_link_not_found_manual_review',['provider_link_not_found_manual_review',409]],
 ['multiple_provider_links_manual_review',['multiple_provider_links_manual_review',409]],
 ['provider_identity_mismatch_manual_review',['provider_identity_mismatch_manual_review',409]],
 ['provider_url_invalid_manual_review',['provider_url_invalid_manual_review',409]]
]);
export async function onRequestPost({request,env}) {
 if(env.CHECKOUT_ISOLATED_SANDBOX!=='true'||env.CHECKOUT_PROVIDER_ENABLED!=='true'||env.CHECKOUT_RESERVATIONS_ENABLED!=='true') return json({error:'checkout_disabled'},503);
 if(request.headers.get('origin')!==new URL(request.url).origin) return json({error:'invalid_origin'},403);
 try {
  const u=await getUserFromSession(request,env);
  if(!u) return json({error:'sign_in_required'},401);
  const m=await getMembership(env,u.email);
  if(!m||m.role!=='owner'||m.status!=='active') return json({error:'owner_required'},403);
  const limit=await rateLimit(env,'lost-checkout:'+m.account_id,5,3600000,{failClosed:true});
  if(!limit.ok) return json({error:'rate_limited'},limit.unavailable?503:429);
  let body;try{body=await request.json();}catch{return json({error:'invalid_json'},400);}
  if(!/^[a-f0-9]{32}$/.test(body?.checkoutId||'')) return json({error:'invalid_checkout'},400);
  const c=await env.DB.prepare("SELECT c.* FROM checkout_intents c JOIN accounts a ON a.id=c.account_id JOIN checkout_provider_claims p ON p.checkout_id=c.id WHERE c.id=? AND c.account_id=? AND c.owner_email=? AND a.owner_email=c.owner_email AND c.status='reserved' AND p.completed_at IS NULL AND p.claimed_at<=?").bind(body.checkoutId,m.account_id,u.email,now()-120000).first();
  if(!c) return json({error:'recovery_unavailable'},409);
  let link;
  try { link=await discoverLostLink(env,c); }
  catch(error) {
   const [code,status]=DISCOVERY_ERRORS.get(error?.message)||['reconciliation_required',503];
   console.error('razorpay checkout recovery blocked',code);
   return json({error:code},status);
  }
  if(!['created','paid','expired','cancelled','partially_paid'].includes(link.status)) return json({error:'provider_review_required'},409);
  await env.DB.batch([
   env.DB.prepare("UPDATE checkout_intents SET status='created',link_id=? WHERE id=?").bind(link.linkId,c.id),
   env.DB.prepare("UPDATE checkout_provider_claims SET provider_url=?,completed_at=? WHERE checkout_id=?").bind(link.url,now(),c.id)
  ]);
  return json({recovered:true,providerStatus:link.status,...(link.status==='created'&&c.expires_at>now()?{url:link.url}:{})});
 } catch {
  console.error('razorpay checkout recovery failed','internal_error');
  return json({error:'reconciliation_required'},503);
 }
}
