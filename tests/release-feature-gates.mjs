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
