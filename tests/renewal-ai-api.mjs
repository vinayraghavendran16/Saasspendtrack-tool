import assert from 'node:assert/strict';
import {onRequestGet as get} from '../functions/api/renewals/ai-analytics.js';
const email='owner@example.invalid';
function fixture(role='owner',status='active',entitled=true,mode='normal'){
 let batches=0;
 const DB={prepare(sql){return {bind(...args){return {sql,args,async run(){assert.match(sql,/^CREATE /);},async first(){
 if(sql.includes('FROM sessions'))return {email};
 if(sql.includes('FROM users'))return {email,status:entitled?'active':'expired',trial_ends_at:0};
 if(sql.includes('FROM memberships'))return {account_id:'a',role,status};
 if(sql.includes('FROM accounts'))return {id:'a',owner_email:email};
 if(sql.includes('FROM payment_ledger'))return {paid_until:null};
 throw Error(sql);
 }}}}},async batch(statements){
 batches++;assert.equal(statements.length,4);
 for(const [i,s] of statements.entries()){assert.deepEqual(s.args,i?['a',10,50,'a',100]:['a',10,50]);assert.match(s.sql,/p.account_id=\?/);assert.match(s.sql,/LIMIT 10001/);}
 if(mode==='fail')throw Error('database failure');
 if(mode==='overflow')return [{results:Array(10001).fill({})},...Array(3).fill({results:[]})];
 if(mode==='malformed')return [];
 return [{results:[{recommendation_id:'r',revision:1,contract_id:'c',published_at:20}]},{results:[{id:'x',recommendation_id:'r',revision:1,action:'accept',occurred_at:30}]},{results:[]},{results:[]}];
 }};
 return {env:{DB,AI_EXPLAINABILITY_ENABLED:'true',PLATFORM_AUDIT_ENABLED:'true',RENEWAL_AI_ANALYTICS_ENABLED:'true'},batches:()=>batches};
}
const q='start=10&end=50&asOf=100';
const req=(query=q,cookie=true)=>new Request('https://example.invalid/api/renewals/ai-analytics?'+query,{headers:cookie?{Cookie:'sst_session='+'a'.repeat(64)}:{}});
const f=fixture();
for(const flag of ['AI_EXPLAINABILITY_ENABLED','PLATFORM_AUDIT_ENABLED','RENEWAL_AI_ANALYTICS_ENABLED'])assert.equal((await get({request:req(),env:{...f.env,[flag]:'false'}})).status,404);
assert.equal((await get({request:req(q,false),env:f.env})).status,401);
for(const x of [fixture('member'),fixture('admin'),fixture('owner','suspended'),fixture('owner','active',false)]){assert.equal((await get({request:req(),env:x.env})).status,403);assert.equal(x.batches(),0);}
for(const query of [q+'&accountId=b','start=50&end=10','start=0&end=99999999999','start=10&end=50&asOf=49','start=10&end=50&asOf=9999999999999','start=x&end=50'])assert.equal((await get({request:req(query),env:f.env})).status,400);
assert.equal(f.batches(),0);
const res=await get({request:req(),env:f.env});assert.equal(res.status,200);const body=await res.json();assert.equal(body.recommendations,1);assert.equal(body.accepted,1);assert.equal(body.medianFirstResponseMs,10);assert.equal(f.batches(),1);
for(const [mode,status] of [['fail',503],['overflow',422],['malformed',503]])assert.equal((await get({request:req(),env:fixture('owner','active',true,mode).env})).status,status);
console.log('PASS renewal analytics API authorization, scoped bindings, limits and failure handling');
