import assert from 'node:assert/strict';
import {onRequestPost as extract} from '../functions/api/extract.js';
let consent = true;
const env={ANTHROPIC_API_KEY:'test-only',EXTRACT_MODEL:'test-model',DB:{prepare(sql){return {bind(){return {async first(){
if(sql.includes('FROM sessions'))return {email:'owner@example.invalid'};
if(sql.includes('FROM users'))return {email:'owner@example.invalid',status:'active'};
if(sql.includes('FROM memberships'))return {email:'owner@example.invalid',account_id:'a',role:'owner',status:'active'};
if(sql.includes('FROM accounts'))return {id:'a',owner_email:'owner@example.invalid'};
if(sql.includes('workspace_ai_settings'))return {enabled:consent ? 1 : 0,consent_version:'workspace-ai-v2',locked:0};
if(sql.includes('rate_limits'))return {count:1};return null;},async run(){return {success:true}}}}}}}};

const originalFetch = globalThis.fetch;
let calls = 0;
const sample = {vendor_name:'Synthetic Vendor', confidence:95, total_contract_value:1200, currency:'EUR', line_items:[{service:'Software',quantity:10,total:1200}]};
async function request() {
 return extract({env,request:new Request('https://example.invalid/api/extract',{method:'POST',headers:{Cookie:'sst_session=test'},body:JSON.stringify({text:'Synthetic contract for ten software seats at EUR 1200 annually.'})})});
}
async function provider(body, status=200) {
 globalThis.fetch=async()=>{calls++;return Response.json(body,{status});};
 return (await request()).json();
}
try {
 assert.deepEqual((await provider({content:[{type:'tool_use',name:'record_contract',input:sample}]})).data,sample);
 for (const input of [[],{}, {...sample,total_contract_value:'1200'}, {...sample,confidence:101}, {...sample,vendor_name:''}, {...sample,line_items:[{service:'Software',quantity:'ten'}]}, {...sample,billing_frequency:'nonsense'}, {...sample,unexpected:'field'}]) {
  assert.equal((await provider({content:[{type:'tool_use',name:'record_contract',input}]})).error,'invalid_result');
 }
 assert.equal((await provider({content:[{type:'tool_use',name:'wrong_tool',input:sample}]})).error,'no_result');
 assert.deepEqual((await provider({content:[{type:'text',text:JSON.stringify(sample)}]})).data,sample);
 assert.equal((await provider({content:[{type:'text',text:'No structured data'}]})).error,'no_result');
 const upstream=await provider({error:{message:'PRIVATE_PROVIDER_DETAIL'}},429);
 assert.equal(upstream.error,'upstream');assert.equal(upstream.upstream_status,429);assert.ok(!JSON.stringify(upstream).includes('PRIVATE_PROVIDER_DETAIL'));
 globalThis.fetch=async()=>{throw new Error('PRIVATE_NETWORK_DETAIL')};
 const network=await (await request()).json();assert.equal(network.error,'exception');assert.ok(!JSON.stringify(network).includes('PRIVATE_NETWORK_DETAIL'));
 consent=false;calls=0;
 assert.equal((await provider({content:[{type:'tool_use',name:'record_contract',input:sample}]})).error,'ai_consent_required');assert.equal(calls,0);
 console.log('PASS: extraction schema validation, successful tool/text responses, malformed output, provider/network errors and consent blocking');
} finally {globalThis.fetch=originalFetch;}
