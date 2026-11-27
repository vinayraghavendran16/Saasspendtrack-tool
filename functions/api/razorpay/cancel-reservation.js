import {json,getUserFromSession,getMembership} from '../../_shared/util.js';
export async function onRequestPost({request,env}) {
  if(env.CHECKOUT_RESERVATIONS_ENABLED!=='true') return json({error:'checkout_disabled'},503);
  if(request.headers.get('origin')!==new URL(request.url).origin) return json({error:'invalid_origin'},403);
  try {
    const u=await getUserFromSession(request,env);
    if(!u) return json({error:'sign_in_required'},401);
    const m=await getMembership(env,u.email);
    if(!m||m.role!=='owner'||m.status!=='active') return json({error:'owner_required'},403);
    let body;
    try {body=await request.json();} catch {return json({error:'invalid_json'},400);}
    if(!/^[a-f0-9]{32}$/.test(body?.checkoutId||'')) return json({error:'invalid_checkout'},400);
    const row=await env.DB.prepare("UPDATE checkout_intents SET status='cancelled',founding_slot=NULL WHERE id=? AND account_id=? AND owner_email=? AND status='reserved' AND EXISTS(SELECT 1 FROM accounts a WHERE a.id=checkout_intents.account_id AND a.owner_email=checkout_intents.owner_email) AND NOT EXISTS(SELECT 1 FROM checkout_provider_claims WHERE checkout_id=checkout_intents.id) RETURNING id").bind(body.checkoutId,m.account_id,u.email).first();
    return row?json({cancelled:true}):json({error:'checkout_not_cancellable'},409);
  } catch {return json({error:'checkout_unavailable'},503);}
}
