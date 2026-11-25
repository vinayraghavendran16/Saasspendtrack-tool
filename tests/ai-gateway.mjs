import assert from 'node:assert/strict';
import {hasAiConsent,aiFetch} from '../functions/_shared/ai-gateway.js';
let row=null, broken=false, calls=[];
const env={DB:{prepare(sql){assert.match(sql,/workspace_ai_settings/);return {bind(id){assert.equal(id,'workspace-a');return {async first(){if(broken)throw Error('DB unavailable');return row;}};}};}}};
const original=globalThis.fetch;
globalThis.fetch=async (url,options)=>{calls.push({url,options});return new Response('{}');};
const url='https://api.anthropic.com/v1/messages';
const send=(e=env,u=url,o={method:'POST'})=>aiFetch(e,'workspace-a',u,o);
try{
 for(const value of [null,{enabled:0,consent_version:'workspace-ai-v2'},{enabled:1,consent_version:'old'}]){
 row=value;assert.equal(await hasAiConsent(env,'workspace-a'),false);await assert.rejects(send());
 }
 row={enabled:1,consent_version:'workspace-ai-v2'};
 broken=true;await assert.rejects(send());broken=false;
 await assert.rejects(send({...env,AI_GLOBAL_DISABLED:'true'}));
 await assert.rejects(send(env,'https://example.test/v1/messages'));
 await assert.rejects(send(env,url,{method:'GET'}));
 assert.equal(calls.length,0);
 await send();assert.equal(calls.length,1);assert.equal(calls[0].options.redirect,'error');
 await send(env,'https://api.anthropic.com/v1/models?limit=100',{method:'GET'});assert.equal(calls.length,2);
 row={enabled:0,consent_version:'workspace-ai-v2'};
 await assert.rejects(send());assert.equal(calls.length,2);
}finally{globalThis.fetch=original;}
console.log('PASS: AI gateway denies unauthorized outbound requests, enforces destination and rechecks revocation');
