import {json,getUserFromSession,getMembership,rateLimit,now,randomToken} from '../../_shared/util.js';

// Reservation only. Provider creation and reconciliation must be implemented
// before enabling this endpoint. Expired reservations are never freed by time alone.
export async function onRequestPost({request,env}) {
  if (env.CHECKOUT_ISOLATED_SANDBOX!=='true' || env.CHECKOUT_RESERVATIONS_ENABLED !== 'true') return json({error:'checkout_disabled'},503);
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({error:'invalid_origin'},403);
  try {
    const user=await getUserFromSession(request,env);
    if (!user) return json({error:'sign_in_required'},401);
    const m=await getMembership(env,user.email);
    if (!m || m.role!=='owner' || m.status!=='active') return json({error:'owner_required'},403);
    const limit=await rateLimit(env,'checkout:'+m.account_id,5,3600000,{failClosed:true});
    if (!limit.ok) return json({error:'checkout_rate_limited'},limit.unavailable?503:429);
    let body;
    try { body=await request.json(); } catch (_) {return json({error:'invalid_json'},400);}
    if (!body || !['founding','standard'].includes(body.tier) || Object.keys(body).length!==1) return json({error:'invalid_plan'},400);
    const tier=body.tier, amount=tier==='founding'?149900:200000;
    const id=randomToken(16), t=now();
    const row=await env.DB.prepare(`WITH RECURSIVE slots(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM slots WHERE n<25)
      INSERT INTO checkout_intents(id,account_id,owner_email,tier,amount,currency,founding_slot,created_at,expires_at)
      SELECT ?,a.id,?,?,?,'USD',CASE WHEN ?='founding' THEN (SELECT MIN(n) FROM slots WHERE NOT EXISTS(SELECT 1 FROM checkout_intents WHERE founding_slot=n) AND NOT EXISTS(SELECT 1 FROM legacy_founding_allocations WHERE slot=n)) ELSE NULL END,?,?
      FROM accounts a WHERE a.id=? AND a.owner_email=?
      AND NOT EXISTS(SELECT 1 FROM checkout_intents WHERE account_id=a.id AND status IN ('reserved','created'))
      AND (?!='founding' OR (EXISTS(SELECT 1 FROM slots WHERE NOT EXISTS(SELECT 1 FROM checkout_intents WHERE founding_slot=n) AND NOT EXISTS(SELECT 1 FROM legacy_founding_allocations WHERE slot=n)) AND NOT EXISTS(SELECT 1 FROM legacy_founding_allocations WHERE account_id=a.id) AND NOT EXISTS(SELECT 1 FROM checkout_intents WHERE account_id=a.id AND tier='founding' AND status='paid')))
      RETURNING id,tier,amount,currency,status,expires_at`).bind(id,user.email,tier,amount,tier,t,t+1800000,m.account_id,user.email,tier).first();
    if (!row) return json({error:'checkout_unavailable'},409);
    return json({checkout:row},201);
  } catch (_) {return json({error:'checkout_unavailable'},503);}
}
