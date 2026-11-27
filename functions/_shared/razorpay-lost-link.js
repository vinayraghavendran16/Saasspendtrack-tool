// Read-only discovery; no automatic retries or reservation releases.
export async function discoverLostLink(env,c,transport=fetch) {
 if(env.CHECKOUT_ISOLATED_SANDBOX!=='true'||env.CHECKOUT_PROVIDER_ENABLED!=='true'||!env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')||!env.RAZORPAY_KEY_SECRET) throw new Error('provider_disabled');
 if(!/^[a-f0-9]{32}$/.test(c.id||'')||c.status!=='reserved'||c.link_id) throw new Error('invalid_checkout');
 const url=new URL('https://api.razorpay.com/v1/payment_links');
 url.searchParams.set('reference_id',c.id);
 const r=await transport(url.href,{method:'GET',redirect:'error',headers:{Authorization:'Basic '+btoa(env.RAZORPAY_KEY_ID+':'+env.RAZORPAY_KEY_SECRET)}});
 if(!r.ok) throw new Error('provider_lookup_unavailable');
 const data=await r.json();
 if(!Array.isArray(data.payment_links)) throw new Error('provider_response_invalid');
 // Zero results do not prove that a timed-out create request was not accepted.
 if(data.payment_links.length===0) throw new Error('provider_link_not_found_manual_review');
 if(data.payment_links.length!==1) throw new Error('multiple_provider_links_manual_review');
 const l=data.payment_links[0];
 if(l.reference_id!==c.id||!/^plink_[A-Za-z0-9]+$/.test(l.id||'')||l.amount!==c.amount||l.currency!==c.currency||String(l.customer?.email||'').trim().toLowerCase()!==c.owner_email) throw new Error('provider_identity_mismatch_manual_review');
 let short;
 try { short=new URL(l.short_url); } catch { throw new Error('provider_url_invalid_manual_review'); }
 if(short.protocol!=='https:'||short.hostname!=='rzp.io'||short.username||short.password||short.port) throw new Error('provider_url_invalid_manual_review');
 return {linkId:l.id,url:short.href,status:l.status};
}
