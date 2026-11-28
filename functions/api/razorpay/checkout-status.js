import {json,getUserFromSession,getMembership,now} from '../../_shared/util.js';
export async function onRequestGet({request,env}) {
 if(env.CHECKOUT_ISOLATED_SANDBOX!=='true'||env.CHECKOUT_RESERVATIONS_ENABLED!=='true') return json({error:'checkout_disabled'},503);
 try {
  const u=await getUserFromSession(request,env);
  if(!u) return json({error:'sign_in_required'},401);
  const m=await getMembership(env,u.email);
  if(!m||m.role!=='owner'||m.status!=='active') return json({error:'owner_required'},403);
  const id=new URL(request.url).searchParams.get('id');
  if(id!==null&&!/^[a-f0-9]{32}$/.test(id)) return json({error:'invalid_checkout'},400);
  const c=await env.DB.prepare("SELECT c.id,c.tier,c.amount,c.currency,c.status,c.expires_at,p.claimed_at,p.completed_at FROM checkout_intents c JOIN accounts a ON a.id=c.account_id LEFT JOIN checkout_provider_claims p ON p.checkout_id=c.id WHERE c.account_id=? AND c.owner_email=? AND a.owner_email=c.owner_email AND (? IS NULL OR c.id=?) ORDER BY CASE WHEN c.status IN ('reserved','created') THEN 0 ELSE 1 END,c.created_at DESC LIMIT 1").bind(m.account_id,u.email,id,id).first();
  if(!c) return json({checkout:null});
  const t=now();
  return json({checkout:{id:c.id,tier:c.tier,amount:c.amount,currency:c.currency,status:c.status,expiresAt:c.expires_at,canCreate:c.status==='reserved'&&c.claimed_at==null&&c.expires_at>t,canResume:c.status==='created'&&c.completed_at!=null&&c.expires_at>t,canCancel:c.status==='reserved'&&c.claimed_at==null,canRecover:c.status==='reserved'&&c.claimed_at!=null&&c.completed_at==null&&c.claimed_at<=t-120000,canCheckRelease:c.status==='created'&&c.completed_at!=null}});
 } catch{return json({error:'checkout_unavailable'},503);}
}
