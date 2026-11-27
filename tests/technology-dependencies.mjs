import assert from 'node:assert/strict';
import {assessDependencyImpact} from '../functions/_shared/technology-dependencies.js';
import {adaptiveReviewHint} from '../functions/_shared/adaptive-review-policy.js';
import * as nodesApi from '../functions/api/technology-graph/nodes.js';
import * as edgesApi from '../functions/api/technology-graph/edges.js';
import * as impactApi from '../functions/api/technology-graph/impact.js';
const nodes=[{id:'crm',kind:'product'},{id:'forecast',kind:'capability'},{id:'sales',kind:'department'},{id:'other',kind:'product'}];
const edges=[{dependentId:'forecast',dependencyId:'crm',criticality:'critical',evidence:'verified'},{dependentId:'sales',dependencyId:'forecast',criticality:'high',evidence:'asserted'},{dependentId:'crm',dependencyId:'sales',criticality:'low',evidence:'verified'}];
const r=assessDependencyImpact({nodes,edges,removeIds:['crm']});
assert.deepEqual(r.affected.map(x=>x.id),['forecast','sales']);
assert.equal(r.affected[1].requiresVerification,true);
assert.equal(r.safeToRemove,null);
assert.equal(assessDependencyImpact({nodes,edges,removeIds:['other']}).safeToRemove,null);
assert.throws(()=>assessDependencyImpact({nodes,edges,removeIds:['unknown']}));
assert.throws(()=>assessDependencyImpact({nodes,edges:[...edges,edges[0]],removeIds:['crm']}));
assert.throws(()=>assessDependencyImpact({nodes,edges:[...edges,{...edges[0],dependencyId:'foreign'}],removeIds:['crm']}));
const hint=(met,unmet)=>adaptiveReviewHint({objective:'efficiency',action:'resize',feedback:[{objective:'efficiency',action:'resize',met,unmet,unknown:0}]});
assert.equal(hint(9,0).hint,'insufficient_evidence');
assert.equal(hint(100,0).hint,'review_positive_history');
assert.equal(hint(1,20).hint,'review_prior_failures');
assert.equal(hint(100,0).changesRecommendation,false);
for(const [handler,method] of [[nodesApi.onRequestGet,'GET'],[nodesApi.onRequestPost,'POST'],[edgesApi.onRequestPost,'POST'],[impactApi.onRequestPost,'POST']]){
 const request=new Request('https://app.saasspendtrack.com/api/technology-graph/test',{method});
 assert.equal((await handler({request,env:{}})).status,404);
 assert.equal((await handler({request,env:{DECISION_INTELLIGENCE_ENABLED:'true'}})).status,401);
}
console.log('19 dependency and adaptive policy assertions passed');
