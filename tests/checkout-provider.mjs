import assert from 'node:assert/strict';
import {createProviderLink} from '../functions/_shared/razorpay-checkout.js';
import {inspectProviderLink} from '../functions/_shared/razorpay-recovery.js';
const env={CHECKOUT_PROVIDER_ENABLED:'true',CHECKOUT_ISOLATED_SANDBOX:'true',RAZORPAY_KEY_ID:'rzp_test_fixture',RAZORPAY_KEY_SECRET:'fixture'};
const c={id:'a'.repeat(32),tier:'founding',amount:149900,currency:'USD',status:'reserved',owner_email:'owner@example.invalid',expires_at:Date.now()+1800000,link_id:'plink_fixture'};
const link={id:c.link_id,reference_id:c.id,amount:c.amount,currency:c.currency,status:'created',short_url:'https://rzp.io/i/fixture',customer:{email:c.owner_email},amount_paid:0,payments:[]};
const mock=(patch={})=>async()=>Response.json({...link,...patch});
assert.equal((await createProviderLink(env,c,mock())).linkId,c.link_id);
for(const patch of [{amount:1},{currency:'INR'},{reference_id:'wrong'},{short_url:'https://evil.invalid'},{status:'paid'}]) await assert.rejects(()=>createProviderLink(env,c,mock(patch)));
assert.equal((await inspectProviderLink(env,c,mock({status:'expired'}))).terminalUnpaid,true);
assert.equal((await inspectProviderLink(env,c,mock({status:'expired',payments:null}))).terminalUnpaid,false);
assert.equal((await inspectProviderLink(env,c,mock({status:'cancelled',amount_paid:1}))).terminalUnpaid,false);
await assert.rejects(()=>inspectProviderLink(env,c,mock({customer:{email:'other@example.invalid'}})));
console.log('PASS: synthetic provider response validation');

let outbound=0;
const forbidden=async()=>{outbound++;throw Error('unexpected network call');};
for(const overrides of [{CHECKOUT_ISOLATED_SANDBOX:'false'},{RAZORPAY_KEY_ID:'rzp_live_fixture'},{CHECKOUT_PROVIDER_ENABLED:'false'}]){
 await assert.rejects(()=>createProviderLink({...env,...overrides},c,forbidden));
 await assert.rejects(()=>inspectProviderLink({...env,...overrides},c,forbidden));
}
assert.equal(outbound,0);
console.log('PASS: disabled or live provider configuration cannot initiate network requests');
