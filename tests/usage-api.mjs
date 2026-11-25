import assert from 'node:assert/strict';
import {onRequestGet as platform} from '../functions/api/platform/usage.js';
import {onRequestGet as workspace} from '../functions/api/account/usage.js';
const owner='platform@example.test';
function fixture(email,role='member',status='active'){
 const queries=[];
 const env={PLATFORM_OWNER_EMAIL:owner,USAGE_HMAC_SECRET:'test',DB:{prepare(sql){return {async run(){return {}},bind(...args){return {
 async first(){
 if(sql.includes('FROM sessions'))return args[0]==='valid'?{email}:null;
 if(sql.includes('FROM users'))return {email};
 if(sql.includes('FROM memberships'))return {email,role,status,account_id:'workspace-a'};
 if(sql.includes('FROM usage_events')){queries.push({sql,args});return {events:1};}
 throw Error('Unexpected query '+sql);
 },
 async all(){queries.push({sql,args});return {results:[]};},
 async run(){return {}}
 };}};}}};
 return {env,queries};
}
const request=(cookie='sst_session=valid',query='')=>new Request('https://example.test/api/usage?'+query,{headers:{cookie}});
for(const [handler,email,role,status,cookie,expected] of [
 [platform,owner,'member','active','',401],
 [platform,'customer@example.test','owner','active','sst_session=valid',403],
 [platform,owner,'member','active','sst_session=valid',200],
 [workspace,'customer@example.test','member','active','sst_session=valid',403],
 [workspace,'customer@example.test','admin','suspended','sst_session=valid',403],
 [workspace,'customer@example.test','admin','active','sst_session=valid',200],
 [workspace,'customer@example.test','owner','active','sst_session=valid',200]
]){
 const {env,queries}=fixture(email,role,status);
 const r=await handler({request:request(cookie,'days=7&account_id=workspace-b'),env});
 assert.equal(r.status,expected);
 if(expected===200){
 assert.match(r.headers.get('cache-control'),/no-store/);
 assert.equal(queries.length,2);
 for(const q of queries){
 if(handler===workspace){assert.match(q.sql,/account_id = \?/);assert.equal(q.args[1],'workspace-a');}
 else assert.equal(q.args.length,1);
 assert.ok(!q.args.includes('workspace-b'));
 }
 }else assert.equal(queries.length,0);
}
const {env}=fixture(owner);
assert.equal((await platform({request:request(undefined,'days=365'),env})).status,400);
assert.equal((await platform({request:request(),env:{...env,USAGE_HMAC_SECRET:''}})).status,503);
console.log('PASS: analytics API role boundaries, scope, invalid windows and missing configuration');
