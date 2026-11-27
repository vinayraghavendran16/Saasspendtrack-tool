import assert from 'node:assert/strict';
import {onRequestGet as pupm} from '../functions/api/financial/pupm.js';
import {onRequestGet as population,onRequestPost as ingest} from '../functions/api/financial/population.js';
import {onRequestGet as trend} from '../functions/api/financial/pupm-trend.js';
const email='owner@example.invalid';
function fixture(role='owner',status='active',entitled=true){
 const calls=[];
 const DB={prepare(sql){return {bind(...args){return {
 async run(){assert.match(sql,/^CREATE /);},
 async first(){
 if(sql.includes('FROM sessions'))return {email};
 if(sql.includes('FROM users'))return {email,status:entitled?'active':'expired',trial_ends_at:0};
 if(sql.includes('FROM memberships'))return {account_id:'a',role,status};
 if(sql.includes('FROM accounts'))return {id:'a',owner_email:email};
 if(sql.includes('FROM payment_ledger'))return {paid_until:null};
 if(sql.startsWith('INSERT INTO pupm_population')){assert.equal(args[0],'a');assert.equal(args[2],'a');calls.push('insert');return {id:args[1]};}
 throw Error(sql);
 },
 async all(){
 assert.equal(args[0],'a');
 if(sql.includes('pupm_population_observations')){assert.equal(args[1],'a');calls.push('population');return {results:[{id:'p',denominator:'employees',population:210}]};}
 if(sql.includes('reporting_financial_facts')){calls.push('ledger');return {results:[{kind:'invoice',currency:'USD',amount_minor:'5000000'},{kind:'credit',currency:'USD',amount_minor:'50000'}]};}
 throw Error(sql);
 }
 }}}}};
 return {env:{DB,PUPM_ENABLED:'true'},calls};
}
const req=(body,cookie=true)=>new Request('https://example.invalid/api/financial/pupm?month=2020-01&accountId=b',{method:body===undefined?'GET':'POST',headers:cookie?{Cookie:'sst_session='+'a'.repeat(64)}:{},body:body===undefined?undefined:JSON.stringify(body)});
for(const handler of [pupm,population,ingest]){
 assert.equal((await handler({request:req(),env:{}})).status,404);
 assert.equal((await handler({request:req(undefined,false),env:fixture().env})).status,401);
 for(const f of [fixture('member'),fixture('owner','suspended'),fixture('owner','active',false)]){
 assert.equal((await handler({request:req(),env:f.env})).status,403);
 assert.deepEqual(f.calls,[]);
 }
}
const f=fixture(),res=await pupm({request:req(),env:f.env});
assert.equal(res.status,200);
assert.equal((await res.json()).metrics[0].amountMinor,'4950000');
assert.deepEqual(f.calls,['population','ledger']);
const b={month:'2020-01',denominator:'employees',count:210,sourceId:'hr',sourceRecordId:'r'};
assert.equal((await ingest({request:req({...b,accountId:'b'}),env:f.env})).status,400);
assert.equal((await ingest({request:req({...b,sourceId:'x'.repeat(5000)}),env:f.env})).status,413);
assert.equal((await ingest({request:req(b),env:f.env})).status,201);
assert.equal((await population({request:req(),env:f.env})).status,200);
console.log('PUPM API handler fixture passed');

const tf=fixture();
const trq=(query,cookie=true)=>new Request('https://example.invalid/api/financial/pupm-trend?'+query,{headers:cookie?{Cookie:'sst_session='+'a'.repeat(64)}:{}});
const q='end=2020-01&months=3&currency=USD&accountId=b';
assert.equal((await trend({request:trq(q),env:{}})).status,404);
assert.equal((await trend({request:trq(q,false),env:tf.env})).status,401);
assert.equal((await trend({request:trq(q),env:fixture('member').env})).status,403);
assert.equal((await trend({request:trq('end=2020-01&months=13&currency=USD'),env:tf.env})).status,400);
const trendResponse=await trend({request:trq(q),env:tf.env});
assert.equal(trendResponse.status,200);
const series=(await trendResponse.json()).periods;
assert.deepEqual(series.map(p=>p.month),['2019-11','2019-12','2020-01']);
assert.equal(series[0].changeBasisPoints,null);
assert.equal(series[1].changeBasisPoints,'0');
assert.equal(series[2].metric.amountMinor,'4950000');
const missing=await trend({request:trq('end=2020-01&months=1&currency=EUR'),env:tf.env});
assert.equal((await missing.json()).periods[0].status,'missing_currency_records');
console.log('historical trend handler fixture passed');

const {onRequestGet:capabilities}=await import('../functions/api/financial/capabilities.js');
assert.equal((await capabilities({request:req(),env:{}})).status,404);
assert.equal((await capabilities({request:req(undefined,false),env:fixture().env})).status,401);
for(const f of [fixture('member'),fixture('admin'),fixture('owner','suspended'),fixture('owner','active',false)])assert.equal((await capabilities({request:req(),env:f.env})).status,403);
for(const [pupm,reviews] of [[true,false],[false,true],[true,true]]){
 const env={...fixture().env,PUPM_ENABLED:String(pupm),DECISION_INTELLIGENCE_ENABLED:String(reviews)};
 const res=await capabilities({request:req(),env});
 assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{financialIntelligence:true,pupm,reviews});
}
console.log('financial capability authorization passed');
