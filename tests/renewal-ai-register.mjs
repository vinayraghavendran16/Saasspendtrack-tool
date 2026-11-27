import assert from 'node:assert/strict';
import {onRequestGet as get} from '../functions/api/renewals/ai-recommendations.js';
const email='owner@example.invalid';
function fixture(role='owner',status='active',entitled=true,mode='normal'){
 let reads=0;
 const DB={prepare(sql){return {bind(...args){return {async run(){assert.match(sql,/^CREATE /);},async first(){
 if(sql.includes('FROM sessions'))return {email};
 if(sql.includes('FROM users'))return {email,status:entitled?'active':'expired',trial_ends_at:0};
 if(sql.includes('FROM memberships'))return {account_id:'a',role,status};
 if(sql.includes('FROM accounts'))return {id:'a',owner_email:email};
 if(sql.includes('FROM payment_ledger'))return {paid_until:null};
 throw Error(sql);
 },async all(){reads++;assert.match(sql,/MAX\(p.revision\)/);assert.match(sql,/p.account_id=\?/);assert.match(sql,/LIMIT 51/);assert.deepEqual(args,['a',10,50,mode==='second'?'r049':'','a']);
 if(mode==='fail')throw Error('db');
 if(mode==='malformed')return {};
 return {results:Array.from({length:mode==='second'?1:51},(_,i)=>({recommendation_id:'r'+String(mode==='second'?50:i).padStart(3,'0'),revision:2,contract_id:'c',published_at:20}))};
 }}}}}};
 return {env:{DB,AI_EXPLAINABILITY_ENABLED:'true',PLATFORM_AUDIT_ENABLED:'true',RENEWAL_AI_ANALYTICS_ENABLED:'true'},reads:()=>reads};
}
const q='start=10&end=50',req=(query=q,cookie=true)=>new Request('https://example.invalid/api/renewals/ai-recommendations?'+query,{headers:cookie?{Cookie:'sst_session='+'a'.repeat(64)}:{}});
const f=fixture();
for(const flag of ['AI_EXPLAINABILITY_ENABLED','PLATFORM_AUDIT_ENABLED','RENEWAL_AI_ANALYTICS_ENABLED'])assert.equal((await get({request:req(),env:{...f.env,[flag]:'false'}})).status,404);
assert.equal((await get({request:req(q,false),env:f.env})).status,401);
for(const x of [fixture('member'),fixture('admin'),fixture('owner','suspended'),fixture('owner','active',false)]){assert.equal((await get({request:req(),env:x.env})).status,403);assert.equal(x.reads(),0);}
for(const query of [q+'&accountId=b','start=50&end=10','start=0&end=9999999999999',q+'&cursor='+ 'x'.repeat(257)])assert.equal((await get({request:req(query),env:f.env})).status,400);
assert.equal(f.reads(),0);
const r=await get({request:req(),env:f.env});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const body=await r.json();assert.equal(body.records.length,50);assert.equal(body.nextCursor,'r049');
const second=await (await get({request:req(q+'&cursor=r049'),env:fixture('owner','active',true,'second').env})).json();assert.equal(second.records.length,1);assert.equal(second.nextCursor,null);
for(const mode of ['fail','malformed'])assert.equal((await get({request:req(),env:fixture('owner','active',true,mode).env})).status,503);
console.log('PASS renewal register authorization and pagination');
