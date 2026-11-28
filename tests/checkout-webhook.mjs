import assert from 'node:assert/strict';
import {onRequestPost} from '../functions/api/razorpay/test-webhook.js';
import {hmacSha256Hex} from '../functions/_shared/util.js';
const secret='synthetic-test-secret';
const env={CHECKOUT_TEST_WEBHOOK_ENABLED:'true',CHECKOUT_PROVIDER_ENABLED:'true',CHECKOUT_ISOLATED_SANDBOX:'true',RAZORPAY_KEY_ID:'rzp_test_fixture',RAZORPAY_TEST_WEBHOOK_SECRET:secret};
async function send(body,overrides={},signed=true){
 const signature=signed?await hmacSha256Hex(secret,body):'invalid';
 return onRequestPost({env:{...env,...overrides},request:new Request('https://example.invalid/api/razorpay/test-webhook',{method:'POST',body,headers:{'X-Razorpay-Signature':signature}})});
}
assert.equal((await send('{}',{CHECKOUT_ISOLATED_SANDBOX:'false'})).status,503);
assert.equal((await send('{}',{RAZORPAY_KEY_ID:'rzp_live_fixture'})).status,503);
assert.equal((await send('{}',{},false)).status,401);
assert.equal((await send('{')).status,400);
assert.equal((await send('{}')).status,200);
assert.equal((await send(JSON.stringify({event:'payment_link.paid'}))).status,422);
console.log('PASS: six sandbox webhook gate and signature checks');

const checkout={id:'a'.repeat(32),link_id:'plink_fixture',owner_email:'owner@example.invalid',currency:'USD',amount:149900,status:'paid',payment_id:'pay_fixture'};
const event={event:'payment_link.paid',payload:{payment_link:{entity:{id:checkout.link_id,reference_id:checkout.id,status:'paid',currency:'USD',amount:149900,amount_paid:149900,customer:{email:checkout.owner_email}}},payment:{entity:{id:'pay_fixture',status:'captured',captured:true,currency:'USD',amount:149900,email:checkout.owner_email}}}};
let writes=0;
const DB={prepare(){return {bind(){return {first:async()=>checkout}}}},batch(){writes++;throw Error('unexpected write')}};
assert.equal((await send(JSON.stringify(event),{DB})).status,200);
event.payload.payment.entity.id='pay_other';
assert.equal((await send(JSON.stringify(event),{DB})).status,422);
event.payload.payment.entity.id='pay_fixture';
event.payload.payment.entity.amount=1;
assert.equal((await send(JSON.stringify(event),{DB})).status,422);
assert.equal(writes,0);
console.log('PASS: paid checkout replay and mismatch never write');
