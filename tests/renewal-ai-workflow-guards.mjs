import assert from 'node:assert/strict';
import * as challenges from '../functions/api/renewals/ai-challenges.js';
import * as resolution from '../functions/api/renewals/ai-challenge-resolution.js';
import * as revisions from '../functions/api/renewals/ai-revisions.js';
import * as response from '../functions/api/renewals/ai-response.js';
const email='owner@example.invalid';
function fixture(role='owner'){
 const DB={prepare(sql){return {bind(){return {async run(){assert.match(sql,/^CREATE /);},async first(){if(sql.includes('FROM sessions'))return {email};if(sql.includes('FROM users'))return {email,status:'active',trial_ends_at:0};if(sql.includes('FROM memberships'))return {account_id:'a',role,status:'active'};if(sql.includes('FROM accounts'))return {id:'a',owner_email:email};if(sql.includes('FROM payment_ledger'))return {paid_until:null};throw Error('unexpected read '+sql);}}}}},async batch(){throw Error('unexpected mutation');}};
 return {DB,AI_EXPLAINABILITY_ENABLED:'true',PLATFORM_AUDIT_ENABLED:'true',RENEWAL_AI_ANALYTICS_ENABLED:'true'};
}
const origin='https://example.invalid';
function req(post,cookie=true,same=true,body='{}'){return new Request(origin+'/api/renewals/test',{method:post?'POST':'GET',headers:{...(cookie?{Cookie:'sst_session='+'a'.repeat(64)}:{}),...(post?{Origin:same?origin:'https://other.invalid','Content-Type':'application/json'}:{})},...(post?{body}:{})});}
for(const [handler,post] of [[challenges.onRequestGet,false],[challenges.onRequestPost,true],[resolution.onRequestPost,true],[revisions.onRequestGet,false],[response.onRequestPost,true]]){
 for(const flag of ['AI_EXPLAINABILITY_ENABLED','PLATFORM_AUDIT_ENABLED','RENEWAL_AI_ANALYTICS_ENABLED'])assert.equal((await handler({request:req(post),env:{...fixture(),[flag]:'false'}})).status,404);
 assert.equal((await handler({request:req(post,false),env:fixture()})).status,401);
 assert.equal((await handler({request:req(post),env:fixture('member')})).status,403);
 assert.equal((await handler({request:req(post),env:fixture()})).status,400);
 if(post){assert.equal((await handler({request:req(true,true,false),env:fixture()})).status,403);assert.equal((await handler({request:req(true,true,true,'x'.repeat(21000)),env:fixture()})).status,413);}
}
console.log('PASS renewal workflow access and mutation guards');
