// Provider adapter only; not exposed as an endpoint.
export async function createProviderLink(env, checkout, transport=fetch) {
  if (env.CHECKOUT_PROVIDER_ENABLED !== 'true') throw new Error('provider_disabled');
  const key=env.RAZORPAY_KEY_ID, secret=env.RAZORPAY_KEY_SECRET;
  if (!key?.startsWith('rzp_test_') || !secret) throw new Error('test_credentials_required');
  const amount={founding:149900,standard:200000}[checkout.tier];
  if (!amount || checkout.amount!==amount || checkout.currency!=='USD' || checkout.status!=='reserved' || !/^[a-f0-9]{32}$/.test(checkout.id)) throw new Error('invalid_checkout');
  const expiry=Math.floor(checkout.expires_at/1000);
  if (!Number.isSafeInteger(expiry) || expiry<=Math.floor(Date.now()/1000)+60) throw new Error('checkout_expired');
  const response=await transport('https://api.razorpay.com/v1/payment_links',{
    method:'POST',redirect:'error',
    headers:{Authorization:'Basic '+btoa(key+':'+secret),'Content-Type':'application/json'},
    body:JSON.stringify({amount,currency:'USD',accept_partial:false,reference_id:checkout.id,expire_by:expiry,customer:{email:checkout.owner_email},notify:{sms:false,email:false},reminder_enable:false,description:'SaaS Spend Track annual subscription'})
  });
  if (!response.ok) throw new Error('provider_reconciliation_required');
  const link=await response.json();
  if (!/^plink_[A-Za-z0-9]+$/.test(link.id||'') || link.reference_id!==checkout.id || link.amount!==amount || link.currency!=='USD' || link.status!=='created') throw new Error('provider_reconciliation_required');
  const url=new URL(link.short_url);
  if (url.protocol!=='https:' || url.hostname!=='rzp.io' || url.username || url.password || url.port) throw new Error('provider_reconciliation_required');
  return {linkId:link.id,url:url.href};
}
