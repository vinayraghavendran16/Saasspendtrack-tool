import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/cron/tick.js';
let sends=0,claimed=false,logged=false,review=false;
const original=globalThis.fetch;
globalThis.fetch=async()=>{sends++;return new Response('{}',{status:200})};
const t=Date.now(),day=86400000;
const user={email:'test@example.test',status:'trial',created_at:t-6*day,trial_ends_at:t+day/2};
const DB={prepare(sql){return {all:async()=>({results:[user]}),bind(...args){return {
 all:async()=>({results:sql.includes('FROM users')?[user]:logged?[{kind:'day6'}]:[]}),
 first:async()=>{if(sql.startsWith('INSERT INTO trial_delivery_claims')){if(claimed)return null;claimed=true;return {id:args[1]}}if(sql.startsWith('UPDATE trial_delivery_claims')){review=args[0]==='review';return {id:args[4]}}throw Error('unexpected query')},
 run:async()=>{if(sql.startsWith('INSERT OR IGNORE INTO email_log'))logged=true;return {meta:{changes:1}}}
 }}}}};
const env={DB,CRON_SECRET:'test-secret',ZEPTOMAIL_TOKEN:'test-token'};
const tick=()=>onRequestGet({request:new Request('https://example.test/api/cron/tick?token=test-secret'),env});
try{
 assert.equal((await tick()).status,200);assert.equal(sends,0);
 env.TRIAL_CADENCE_ENABLED='true';
 assert.equal((await tick()).status,200);assert.equal(sends,1);assert.equal(logged,true);
 logged=false;
 assert.equal((await tick()).status,200);assert.equal(sends,1);
 claimed=false;
 globalThis.fetch=async()=>{sends++;throw Error('network failure')};
 assert.equal((await tick()).status,200);assert.equal(review,true);
 assert.equal((await tick()).status,200);assert.equal(sends,2);
 env.PLATFORM_OWNER_EMAIL=' TEST@EXAMPLE.TEST ';
 claimed=false;
 user.trial_ends_at=t-day;
 assert.equal((await tick()).status,200);
 assert.equal(sends,2);
 assert.equal(claimed,false);
 assert.equal(user.status,'trial');
}finally{globalThis.fetch=original}
console.log('PASS: scheduler disabled, accepted and ambiguous delivery paths');
