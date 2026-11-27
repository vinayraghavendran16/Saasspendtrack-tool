import {json,getUserFromSession,getMembership,now} from '../../_shared/util.js';
import {createProviderLink} from '../../_shared/razorpay-checkout.js';

export async function onRequestPost({request,env}) {
  if (env.CHECKOUT_ISOLATED_SANDBOX!=='true' || env.CHECKOUT_RESERVATIONS_ENABLED!=='true' || env.CHECKOUT_PROVIDER_ENABLED!=='true' || !env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') || !env.RAZORPAY_KEY_SECRET) return json({error:'checkout_disabled'},503);
  if (request.headers.get('origin')!==new URL(request.url).origin) return json({error:'invalid_origin'},403);
  try {
    const user=await getUserFromSession(request,env);
    if (!user) return json({error:'sign_in_required'},401);
    const m=await getMembership(env,user.email);
    if (!m || m.role!=='owner' || m.status!=='active') return json({error:'owner_required'},403);
    let body;
    try {body=await request.json();} catch (_) {return json({error:'invalid_json'},400);}
    if (!/^[a-f0-9]{32}$/.test(body?.checkoutId||'')) return json({error:'invalid_checkout'},400);
    const c=await env.DB.prepare('SELECT c.* FROM checkout_intents c JOIN accounts a ON a.id=c.account_id WHERE c.id=? AND c.account_id=? AND c.owner_email=? AND a.owner_email=c.owner_email').bind(body.checkoutId,m.account_id,user.email).first();
    if (!c) return json({error:'checkout_not_found'},404);
    if (c.expires_at<=now() || !['reserved','created'].includes(c.status)) return json({error:'checkout_unavailable'},409);
    if (c.status==='created') {
      const prior=await env.DB.prepare('SELECT provider_url FROM checkout_provider_claims WHERE checkout_id=?').bind(c.id).first();
      return prior?.provider_url?json({url:prior.provider_url}):json({error:'reconciliation_required'},409);
    }
    const claim=await env.DB.prepare('INSERT INTO checkout_provider_claims(checkout_id,claimed_at) VALUES (?,?) ON CONFLICT(checkout_id) DO NOTHING RETURNING checkout_id').bind(c.id,now()).first();
    if (!claim) return json({error:'reconciliation_required'},409);
    const link=await createProviderLink(env,c);
    await env.DB.batch([
      env.DB.prepare("UPDATE checkout_intents SET status='created',link_id=? WHERE id=?").bind(link.linkId,c.id),
      env.DB.prepare('UPDATE checkout_provider_claims SET provider_url=?,completed_at=? WHERE checkout_id=?').bind(link.url,now(),c.id)
    ]);
    return json({url:link.url},201);
  } catch (_) {return json({error:'reconciliation_required'},503);}
}
