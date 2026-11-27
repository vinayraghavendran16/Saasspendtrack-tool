import {reconcileSavings} from './savings-reconcile.js';
// Evidence completeness and baseline approval must be established externally.
// Invoice variance is not necessarily caused by this decision.
export function evaluateFinancialOutcome({evaluation,approval,facts}){
 if(!evaluation||!approval||approval.status!=='approved'||!Number.isSafeInteger(approval.revision)||approval.revision<1)throw Error('approval required');
 const chosen=evaluation.alternatives.find(a=>a.id===approval.alternativeId&&a.eligible===true);
 if(!chosen)throw Error('eligible approved alternative required');
 if(typeof evaluation.baselineMinor!=='string'||!/^\d+$/.test(evaluation.baselineMinor)||BigInt(evaluation.baselineMinor)>BigInt(Number.MAX_SAFE_INTEGER))throw Error('invalid baseline');
 const r=reconcileSavings({baselineMinor:Number(evaluation.baselineMinor),currency:evaluation.currency,scopeKey:evaluation.scopeKey,periodKey:evaluation.periodKey,facts});
 return {...r,expectedSavingsMinor:chosen.netSavingsMinor,varianceToExpectedMinor:(BigInt(r.varianceMinor)-BigInt(chosen.netSavingsMinor)).toString(),attribution:'not_established',learningEligible:false,status:'requires_finance_review'};
}
