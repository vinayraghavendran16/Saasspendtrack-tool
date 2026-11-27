import assert from 'node:assert/strict';
import {publishRecommendation} from '../functions/_shared/ai-recommendation-publication.js';

const pages=['Clause 8.2: Written notice is required before renewal.'];
const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(pages)))),x=>x.toString(16).padStart(2,'0')).join('');
const guard={membership:{role:'owner',status:'active',account_id:'a'},user:{email:'owner@example.invalid'}};
const ref={artifactType:'msa',evidenceKind:'direct',artifactId:'msa1',artifactDigest:digest,locator:{page:1,start:0,end:10,quote:'Clause 8.2'}};
const input={recommendationId:'renewal-1',revision:1,module:'renewals',rationale:'Review the notice clause.',assumptions:[],limitations:['Review with procurement.'],modelVersion:'example-model-1',contractId:'contract-1',evidence:[ref]};
function fixture({revoked=false,failAt=null,revisionExists=false,contractMismatch=false}={}){
 const committed=[],sqls=[];let reads=0,batches=0;
 const db={
  prepare(sql){return {bind(...args){
   if(sql.startsWith('SELECT'))return {async first(){
    reads++;
    assert.equal(args[0],'a');assert.equal(args[1],'msa1');assert.match(args[2],/^[a-f0-9]{64}$/);
    return revoked?null:{pages_json:JSON.stringify(pages),digest};
   }};
   return {sql,args};
  }};},
  async batch(statements){
   batches++;
   assert.equal(statements.length,4);
   sqls.push(...statements);
   assert.match(statements[0].sql,/INSERT INTO ai_recommendation_revisions/);
   assert.match(statements[1].sql,/INSERT INTO ai_recommendation_evidence/);
   assert.match(statements[2].sql,/INSERT INTO platform_audit_events/);
   assert.match(statements[3].sql,/INSERT INTO ai_recommendation_publications/);
   assert.equal(statements[0].args[0],'a');
   assert.equal(statements[1].args[0],'a');
   assert.equal(statements[2].args[0],'a');
   assert.equal(statements[3].args[0],'a');
   assert.equal(statements[3].args[3],'contract-1');
   assert.equal(statements[2].args[1],statements[3].args[4]);
   assert.equal(statements[2].args[4],'renewal-1');
   if(revisionExists||contractMismatch||failAt!==null)throw new Error(revisionExists?'revision conflict':contractMismatch?'contract mismatch':'injected failure '+failAt);
   committed.push(...statements);
   return statements.map(()=>({success:true}));
  }
 };
 return {env:{AI_EXPLAINABILITY_ENABLED:'true',PLATFORM_AUDIT_ENABLED:'true',DB:db},get committed(){return committed.length;},get reads(){return reads;},get batches(){return batches;},get statements(){return sqls;}};
}
{
 const f=fixture(),result=await publishRecommendation(f.env,guard,input);
 assert.equal(result.status,'published');
 assert.equal(result.recommendationId,'renewal-1');
 assert.equal(f.committed,4);
 assert.equal(f.batches,1);
 assert.equal(f.reads,1);
 assert.equal(result.auditId,f.statements[2].args[1]);
}
for(const property of ['AI_EXPLAINABILITY_ENABLED','PLATFORM_AUDIT_ENABLED']){
 const f=fixture();f.env[property]='false';
 await assert.rejects(publishRecommendation(f.env,guard,input),/disabled/);
 assert.equal(f.batches,0);assert.equal(f.reads,0);
}
for(const g of [{...guard,membership:{...guard.membership,role:'member'}},{...guard,membership:{...guard.membership,status:'suspended'}},{...guard,response:new Response(null,{status:403})}]){
 const f=fixture();await assert.rejects(publishRecommendation(f.env,g,input),/owner authorization required/);assert.equal(f.batches,0);
}
for(const changes of [{evidence:[]},{revision:0},{recommendationId:''},{evidence:[{...ref,artifactType:'unknown'}]}]){
 const f=fixture();await assert.rejects(publishRecommendation(f.env,guard,{...input,...changes}));assert.equal(f.batches,0);
}
for(const changes of [
 {evidence:[{...ref,locator:{...ref.locator,quote:'Clause 9.9'}}]},
 {evidence:[{...ref,locator:{...ref.locator,page:2}}]},
 {evidence:[{...ref,artifactDigest:'a'.repeat(64)}]}
]){
 const f=fixture();await assert.rejects(publishRecommendation(f.env,guard,{...input,...changes}),/unverified evidence/);assert.equal(f.batches,0);
}
{
 const f=fixture({revoked:true});await assert.rejects(publishRecommendation(f.env,guard,input),/unverified evidence/);assert.equal(f.batches,0);
}
for(const opt of [{revisionExists:true},{contractMismatch:true},{failAt:0},{failAt:1},{failAt:2},{failAt:3}]){
 const f=fixture(opt);await assert.rejects(publishRecommendation(f.env,guard,input));assert.equal(f.committed,0);assert.equal(f.batches,1);
}
// Test batching contract only: the fixture models atomic D1 behaviour; actual SQLite transaction tests are separate.
console.log('PASS AI publication validation, authorized evidence, audit linkage, one-batch and failure contracts');
