import {hmacSha256Hex,safeEqual,normalizeEmail,now} from '../../_shared/util.js';
const reply=(s,status)=>new Response(s,{status});
export async function onRequestPost({request,env}) {
  if(env.CHECKOUT_TEST_WEBHOOK_ENABLED!=='true'||env.CHECKOUT_PROVIDER_ENABLED!=='true'||!env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')||!env.RAZORPAY_TEST_WEBHOOK_SECRET||env.CHECKOUT_ISOLATED_SANDBOX!=='true') return reply('disabled',503);
  const raw=await request.text();
  if(!safeEqual(await hmacSha256Hex(env.RAZORPAY_TEST_WEBHOOK_SECRET,raw),request.headers.get('X-Razorpay-Signature')||'')) return reply('invalid signature',401);
  let event;
  try {event=JSON.parse(raw);} catch {return reply('invalid json',400);}
  if(event?.event!=='payment_link.paid') return reply('ignored',200);
  const l=event.payload?.payment_link?.entity,p=event.payload?.payment?.entity;
  if(!l||!p||!/^pay_[A-Za-z0-9]+$/.test(p.id||'')||!/^plink_[A-Za-z0-9]+$/.test(l.id||'')||l.status!=='paid'||p.status!=='captured'||p.captured!==true) return reply('review required',422);
  try {
    const c=await env.DB.prepare('SELECT * FROM checkout_intents WHERE id=? AND link_id=?').bind(l.reference_id,l.id).first();
    if(!c) {
      const pending=await env.DB.prepare("SELECT c.id FROM checkout_intents c JOIN checkout_provider_claims q ON q.checkout_id=c.id WHERE c.id=? AND c.status='reserved' AND q.completed_at IS NULL").bind(l.reference_id).first();
      return reply(pending?'retry after link recovery':'review required',pending?503:422);
    }
    if(c.currency!=='USD'||l.currency!==c.currency||p.currency!==c.currency||l.amount!==c.amount||l.amount_paid!==c.amount||p.amount!==c.amount||normalizeEmail(l.customer?.email)!==c.owner_email||(p.email&&normalizeEmail(p.email)!==c.owner_email)) return reply('review required',422);
    if(c.status==='paid') return reply(c.payment_id===p.id?'already processed':'review required',c.payment_id===p.id?200:422);
    if(c.status!=='created') return reply('review required',422);
    const t=now();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO payment_ledger(payment_id,link_id,customer_email,tier,amount,currency,recorded_at,entitlement_until)
      SELECT ?,c.link_id,c.owner_email,c.tier,c.amount,c.currency,?,CAST(strftime('%s',datetime(MAX(?,COALESCE((SELECT MAX(entitlement_until) FROM payment_ledger WHERE customer_email=c.owner_email),0))/1000,'unixepoch','+12 months')) AS INTEGER)*1000
      FROM checkout_intents c JOIN accounts a ON a.id=c.account_id JOIN memberships m ON m.account_id=a.id AND m.email=c.owner_email JOIN users u ON u.email=c.owner_email WHERE c.id=? AND c.status='created' AND a.owner_email=c.owner_email AND m.role='owner' AND m.status='active'`).bind(p.id,t,t,c.id),
      env.DB.prepare("UPDATE checkout_intents SET status='paid',payment_id=? WHERE id=?").bind(p.id,c.id),
      env.DB.prepare("UPDATE users SET status='active',plan='annual-usd',paid_at=?,rp_payment_id=?,amount_paid=?,currency='USD' WHERE email=?").bind(t,p.id,c.amount,c.owner_email)
    ]);
    return reply('ok',200);
  } catch {
    return reply('retry or review required',503);
  }
}
