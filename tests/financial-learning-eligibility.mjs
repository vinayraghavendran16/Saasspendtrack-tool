import assert from 'node:assert/strict';
import {financialLearningEligibility as check} from '../functions/_shared/financial-learning-eligibility.js';
const review={evidenceLevel:'ledger_reconciled'};
const attestation={baselineApproved:true,periodComplete:true,attributionVerified:true,exclusiveEvidenceAllocation:true,reviewerId:'finance-reviewer',evidenceDigest:'a'.repeat(64)};
assert.equal(check({review,attestation}).eligible,true);
assert.equal(check().eligible,false);
assert.equal(check({review}).eligible,false);
for(const key of ['baselineApproved','periodComplete','attributionVerified','exclusiveEvidenceAllocation']){
 assert.equal(check({review,attestation:{...attestation,[key]:false}}).eligible,false);
 assert.equal(check({review,attestation:{...attestation,[key]:'true'}}).eligible,false);
}
assert.equal(check({review,attestation:{...attestation,reviewerId:' '}}).eligible,false);
assert.equal(check({review,attestation:{...attestation,evidenceDigest:'z'.repeat(64)}}).eligible,false);
assert.equal(check({review:{evidenceLevel:'projected'},attestation}).eligible,false);
assert.equal(check({review,attestation}).mode,'descriptive_only');
console.log('Financial learning eligibility assertions passed');
