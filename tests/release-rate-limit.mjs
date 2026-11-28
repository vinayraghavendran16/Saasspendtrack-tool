import assert from 'node:assert/strict';
import {rateLimit} from '../functions/_shared/util.js';
let calls=0;
const env={DB:{prepare(){calls++;throw Error('unavailable')}}};
for(const [key,limit,window] of [['',1,1000],['a',0,1000],['a',1,0],['a',NaN,1000]]){
 assert.equal((await rateLimit(env,key,limit,window)).ok,false);
}
assert.equal(calls,0);
assert.equal((await rateLimit(env,'a',1,1000,{failClosed:true})).ok,false);
assert.equal((await rateLimit(env,'a',1,1000)).ok,true);
console.log('PASS: rate limiter configuration and outage policy');
