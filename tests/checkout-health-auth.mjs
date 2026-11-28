import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/razorpay/health.js';
const request=new Request('https://sandbox.example.test/api/razorpay/health');
let reads=0;
const DB={prepare(){reads++;throw Error('unexpected database access');}};
for(const flags of [{},{CHECKOUT_ISOLATED_SANDBOX:'true'},{CHECKOUT_HEALTH_ENABLED:'true'}]){
 const r=await onRequestGet({request,env:{DB,...flags}});
 assert.equal(r.status,503);
}
const r=await onRequestGet({request,env:{DB,CHECKOUT_ISOLATED_SANDBOX:'true',CHECKOUT_HEALTH_ENABLED:'true'}});
assert.ok([401,403].includes(r.status));
assert.equal(reads,0);
console.log('PASS: payment health disabled and anonymous access blocked');
