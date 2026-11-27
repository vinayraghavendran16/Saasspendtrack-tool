import {sendEmail,paidEmail} from './email.js';
export async function processPaymentNotifications(env){
 const now=Date.now(),lease=now+120000;
 const {results=[]}=await env.DB.prepare("SELECT payment_id FROM payment_notification_outbox WHERE (status='pending' AND next_attempt_at<=?) OR (status='leased' AND lease_until<=?) LIMIT 20").bind(now,now).all();
 for(const {payment_id:id} of results){
  const claim=await env.DB.prepare("UPDATE payment_notification_outbox SET status='leased',lease_until=?,attempts=attempts+1 WHERE payment_id=? AND ((status='pending' AND next_attempt_at<=?) OR (status='leased' AND lease_until<=?)) RETURNING attempts").bind(lease,id,now,now).first();
  if(!claim)continue;
  let accepted=false;
  try{
   const p=await env.DB.prepare('SELECT * FROM payment_ledger WHERE payment_id=?').bind(id).first();
   if(p){const m=paidEmail({amount:p.amount,currency:p.currency,expiresAt:p.entitlement_until});accepted=(await sendEmail(env,{to:p.customer_email,...m})).ok===true;}
  }catch{}
  await env.DB.prepare("UPDATE payment_notification_outbox SET status=?,next_attempt_at=?,lease_until=NULL WHERE payment_id=? AND status='leased' AND lease_until=?").bind(accepted?'accepted':claim.attempts>=5?'dead':'pending',Date.now()+Math.min(3600000,60000*2**claim.attempts),id,lease).run();
 }
}
