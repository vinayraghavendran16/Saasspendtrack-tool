import assert from 'node:assert/strict';
import {compareScenarios} from '../functions/_shared/aop-compare.js';
const a={month:'2027-01',currency:'USD',expenseMinor:'100'};
assert.equal(compareScenarios({totals:[a]},{totals:[{...a,expenseMinor:'120'}]})[0].deltaMinor,'20');
assert.equal(compareScenarios({totals:[a]},{totals:[]})[0].deltaMinor,null);
assert.throws(()=>compareScenarios({totals:[a,a]},{totals:[]}));
console.log('3 scenario comparison assertions passed');
