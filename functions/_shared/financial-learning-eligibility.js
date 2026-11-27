// Pure policy only. Inputs must be loaded from authenticated, immutable server records.
// A reconciled invoice variance alone never establishes decision-attributed savings.
export function financialLearningEligibility({review,attestation}={}){
 const reasons=[];
 if(review?.evidenceLevel!=='ledger_reconciled')reasons.push('ledger_reconciliation_required');
 if(attestation?.baselineApproved!==true)reasons.push('baseline_approval_required');
 if(attestation?.periodComplete!==true)reasons.push('complete_period_required');
 if(attestation?.attributionVerified!==true)reasons.push('attribution_review_required');
 if(attestation?.exclusiveEvidenceAllocation!==true)reasons.push('exclusive_allocation_required');
 if(typeof attestation?.reviewerId!=='string'||!attestation.reviewerId.trim())reasons.push('reviewer_required');
 if(typeof attestation?.evidenceDigest!=='string'||! /^[a-f0-9]{64}$/.test(attestation.evidenceDigest))reasons.push('evidence_digest_required');
 return {eligible:reasons.length===0,reasons,mode:'descriptive_only'};
}
