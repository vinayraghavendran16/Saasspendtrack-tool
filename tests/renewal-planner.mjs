import assert from 'node:assert/strict';
import {planRenewals} from '../functions/_shared/renewal-planner.js';
const input={today:'2027-06-01',contracts:[{id:'c',vendor_id:'v',end_date:'2027-07-01'}],assignments:[{vendor_id:'v',role:'business',member_email:'b',accepted_at:1},{vendor_id:'v',role:'finance',member_email:'f',accepted_at:1}],members:[{email:'b',status:'active',role:'member'},{email:'f',status:'suspended',role:'member'},{email:'o',status:'active',role:'owner'}]};
assert.deepEqual(planRenewals(input).jobs.map(j=>j.recipientEmail),['b','o']);
assert.equal(planRenewals(input).jobs[0].milestone,30);
assert.equal(planRenewals({...input,members:[]}).unroutable.length,1);
console.log('3 renewal planner assertions passed');
