import assert from 'node:assert/strict';
import * as scenarios from '../functions/api/aop/scenarios.js';
import * as revisions from '../functions/api/aop/revisions.js';
import * as approve from '../functions/api/aop/approve.js';
import * as report from '../functions/api/commercial/report.js';
for(const [route,method,flag] of [[scenarios,'Get','AOP_ENABLED'],[scenarios,'Post','AOP_ENABLED'],[revisions,'Get','AOP_ENABLED'],[revisions,'Post','AOP_ENABLED'],[approve,'Post','AOP_ENABLED'],[report,'Get','COMMERCIAL_REPORTS_ENABLED']]){
 const request=new Request('https://example.invalid/api/test',{method:method.toUpperCase()});
 const handler=route['onRequest'+method];
 assert.equal((await handler({request,env:{}})).status,404);
 assert.equal((await handler({request,env:{[flag]:'true'}})).status,401);
}
console.log('12 advanced feature gate assertions passed');

// Direct CLM proxy must remain closed even if a legacy flag is set.
const clm = await import('../functions/api/clm-sync.js');
const previousFetch = globalThis.fetch;
let outbound = 0;
globalThis.fetch = async () => { outbound++; throw new Error('unexpected network request'); };
try {
  for (const env of [{}, { CLM_ENABLED:'true', CLM_SYNC_ENABLED:'true' }]) {
    const request = new Request('https://example.invalid/api/clm-sync',{method:'POST',body:JSON.stringify({baseUrl:'https://example.invalid',token:'synthetic'})});
    const response = await clm.onRequestPost({request,env});
    assert.equal(response.status,503);
    assert.equal((await response.json()).error,'feature_unavailable');
  }
  assert.equal((await clm.onRequestOptions()).status,405);
  assert.equal(outbound,0);
} finally { globalThis.fetch = previousFetch; }
console.log('PASS: generic CLM proxy cannot be enabled or make outbound requests');
