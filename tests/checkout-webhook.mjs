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
