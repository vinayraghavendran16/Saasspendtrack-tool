import assert from 'node:assert/strict';
import {summarizeDecisionFeedback} from '../functions/_shared/decision-feedback.js';
import * as create from '../functions/api/decisions/create.js';
import * as approve from '../functions/api/decisions/approve.js';
import * as outcome from '../functions/api/decisions/outcome.js';
import * as revisions from '../functions/api/decisions/revisions.js';
const row=(i,extra={})=>({decisionId:'d'+i,revision:1,action:'resize',objective:'efficiency',outcome:'met',evidence:'verified',...extra});
assert.equal(summarizeDecisionFeedback([row(1)])[0].observedSuccessRate,null);
const history=Array.from({length:10},(_,i)=>row(i,{outcome:i<7?'met':'unmet'}));
assert.equal(summarizeDecisionFeedback(history)[0].observedSuccessRate,.7);
assert.equal(summarizeDecisionFeedback([...history,row(10,{outcome:'unknown'})])[0].observed,10);
assert.throws(()=>summarizeDecisionFeedback([row(1),row(1)]));
assert.throws(()=>summarizeDecisionFeedback([row(1,{evidence:'owner_attested'})]));
for(const [handler,method] of [[create.onRequestPost,'POST'],[approve.onRequestPost,'POST'],[outcome.onRequestPost,'POST'],[revisions.onRequestPost,'POST'],[revisions.onRequestGet,'GET']]){
 const request=new Request('https://app.saasspendtrack.com/api/decisions/test',{method});
 assert.equal((await handler({request,env:{}})).status,404);
 assert.equal((await handler({request,env:{DECISION_INTELLIGENCE_ENABLED:'true'}})).status,401);
}
console.log('15 decision feedback and endpoint gate assertions passed');
