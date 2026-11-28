import assert from 'node:assert/strict';
import {aiFetch} from '../functions/_shared/ai-gateway.js';
const url='https://api.anthropic.com/v1/messages';
let calls=0;
const original=globalThis.fetch;
globalThis.fetch=async()=>{calls++;return new Response('{}')};
function fixture({revoke=false,failAudit=false}={}){
 let reads=0;const outcomes=[];
 return {outcomes,env:{DB:{prepare(sql){return {bind(...args){return {
 first:async()=>({enabled:revoke&&++reads>1?0:1,locked:0,consent_version:'workspace-ai-v2'}),
 run:async()=>{if(failAudit)throw Error('audit unavailable');outcomes.push(args[3]);}
 }}}}}}};
}
try{
 let f=fixture({revoke:true});
 await assert.rejects(aiFetch(f.env,'a',url,{method:'POST'}));
 assert.deepEqual(f.outcomes,['authorized','denied']);
 f=fixture({failAudit:true});
 await assert.rejects(aiFetch(f.env,'a',url,{method:'POST'}));
 f=fixture();
 await assert.rejects(aiFetch(f.env,'a','https://example.test',{method:'POST'}));
 assert.equal(calls,0);
 await aiFetch(f.env,'a',url,{method:'POST'});
 assert.equal(calls,1);
 assert.deepEqual(f.outcomes,['authorized','http_success']);
}finally{globalThis.fetch=original}
console.log('PASS: AI egress authorization and audit boundaries');
