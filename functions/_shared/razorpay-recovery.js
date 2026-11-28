// Read-only recovery. Never release a reservation based solely on this helper.
export async function inspectProviderLink(env, checkout, transport=fetch) {
  if (env.CHECKOUT_ISOLATED_SANDBOX!=='true'||env.CHECKOUT_PROVIDER_ENABLED!=='true'||!env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')||!env.RAZORPAY_KEY_SECRET) throw new Error('test_provider_disabled');
  if(!/^[a-f0-9]{32}$/.test(checkout.id||'')||!/^plink_[A-Za-z0-9]+$/.test(checkout.link_id||'')) throw new Error('known_link_required');
  const response=await transport('https://api.razorpay.com/v1/payment_links/'+encodeURIComponent(checkout.link_id),{
    method:'GET',redirect:'manual',headers:{Authorization:'Basic '+btoa(env.RAZORPAY_KEY_ID+':'+env.RAZORPAY_KEY_SECRET)}
  });
  if(!response.ok) throw new Error('provider_status_unavailable');
  const link=await response.json();
  if(link.id!==checkout.link_id||link.reference_id!==checkout.id||link.amount!==checkout.amount||link.currency!==checkout.currency||String(link.customer?.email||'').trim().toLowerCase()!==checkout.owner_email) throw new Error('provider_identity_mismatch');
  if(!Number.isSafeInteger(link.amount_paid)||link.amount_paid<0||link.amount_paid>checkout.amount) throw new Error('provider_amount_invalid');
  // Razorpay documents payments as null until a payment is successfully captured.
  // A terminal status plus zero amount_paid and null/empty payments is safe evidence.
  const noCapturedPayments=link.payments==null||(Array.isArray(link.payments)&&link.payments.length===0);
  const terminalUnpaid=['cancelled','expired'].includes(link.status)&&link.amount_paid===0&&noCapturedPayments;
  return {linkId:link.id,status:link.status,amountPaid:link.amount_paid,terminalUnpaid};
}
