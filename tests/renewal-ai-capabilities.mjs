import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/renewals/ai-analytics-capabilities.js';
const email='owner@example.invalid',req=(cookie=true)=>new Request('https://example.invalid/api/renewals/ai-analytics-capabilities',{headers:cookie?{Cookie:'sst_session='+'a'.repeat(64)}:{}});
function env(role='owner',status='active',entitled=true){
 const DB={prepare(sql){return {bind(){return {async run(){assert.match(sql,/^CREATE /);},async first(){
 if(sql.includes('FROM sessions'))return {email};
 if(sql.includes('FROM users'))return {email,status:entitled?'active':'expired',trial_ends_at:0};
 if(sql.includes('FROM memberships'))return {account_id:'a',role,status};
 if(sql.includes('FROM accounts'))return {id:'a',owner_email:email};
 if(sql.includes('FROM payment_ledger'))return {paid_until:null};
 throw Error(sql);
 }}}}}};
 return {DB,AI_EXPLAINABILITY_ENABLED:'true',PLATFORM_AUDIT_ENABLED:'true',RENEWAL_AI_ANALYTICS_ENABLED:'true'};
}
for(const flag of ['AI_EXPLAINABILITY_ENABLED','PLATFORM_AUDIT_ENABLED','RENEWAL_AI_ANALYTICS_ENABLED'])assert.equal((await onRequestGet({request:req(),env:{...env(),[flag]:'false'}})).status,404);
assert.equal((await onRequestGet({request:req(false),env:env()})).status,401);
for(const [role,status,entitled] of [['member','active',true],['admin','active',true],['owner','suspended',true],['owner','active',false]])assert.equal((await onRequestGet({request:req(),env:env(role,status,entitled)})).status,403);
const r=await onRequestGet({request:req(),env:env()});assert.equal(r.status,200);assert.deepEqual(await r.json(),{renewalAiAnalytics:true});assert.equal(r.headers.get('cache-control'),'no-store');
console.log('PASS renewal AI capability authorization and fail-closed flags');
