import {compareAlternatives} from './commercial-alternatives.js';
// Deterministic, tenant-local decision support. Never executes a recommendation.
export function evaluateDecision({baseline,alternatives,objective}){
 if(!baseline||!Array.isArray(alternatives)||!alternatives.length||alternatives.length>50||!['efficiency','growth','risk'].includes(objective))throw Error('invalid decision');
 if(!/^[A-Z]{3}$/.test(baseline.currency)||typeof baseline.scopeKey!=='string'||!baseline.scopeKey||typeof baseline.periodKey!=='string'||!baseline.periodKey)throw Error('invalid baseline');
 const ids=new Set();
 const rows=compareAlternatives(baseline,alternatives);
 const evaluated=alternatives.map((a,i)=>{
  if(typeof a.id!=='string'||!a.id||ids.has(a.id))throw Error('duplicate alternative');ids.add(a.id);
  if(!['verified','quoted','assumed'].includes(a.evidence)||!['allowed','blocked','unknown'].includes(a.contractEligibility)||!['met','unmet','unknown'].includes(a.businessRequirements))throw Error('invalid evidence or constraint');
  const eligible=a.contractEligibility==='allowed'&&a.businessRequirements==='met'&&a.evidence!=='assumed';
  return {...rows[i],evidence:a.evidence,contractEligibility:a.contractEligibility,businessRequirements:a.businessRequirements,eligible,reason:eligible?'requires_human_approval':'constraint_or_evidence_unresolved'};
 });
 const eligible=evaluated.filter(a=>a.eligible);
 // Growth and risk are not reduced to price: require an explicit human choice.
 const ranked=objective==='efficiency'?eligible.sort((a,b)=>BigInt(a.totalMinor)<BigInt(b.totalMinor)?-1:BigInt(a.totalMinor)>BigInt(b.totalMinor)?1:a.id<b.id?-1:a.id>b.id?1:0):[];
 const best=ranked[0];
 const baselineCost=[baseline.recurringMinor,baseline.exitMinor,baseline.migrationMinor,baseline.overlapMinor].reduce((s,n)=>s+BigInt(n),0n);
 return {objective,currency:baseline.currency,scopeKey:baseline.scopeKey,periodKey:baseline.periodKey,baselineMinor:baselineCost.toString(),alternatives:evaluated,suggestedAlternativeId:best&&BigInt(best.netSavingsMinor)>0n?best.id:null,status:'requires_human_review'};
}
