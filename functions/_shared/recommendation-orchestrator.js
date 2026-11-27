import {evaluateDecision} from './decision-evaluation.js';
import {assessDependencyImpact} from './technology-dependencies.js';
import {adaptiveReviewHint} from './adaptive-review-policy.js';
// Planning-only result. Graph coverage is unknown; removal is never cleared here.
export function orchestrateRecommendation({decision,graph,plans,feedback=[]}){
 const evaluation=evaluateDecision(decision);
 if(!Array.isArray(plans)||plans.length!==evaluation.alternatives.length)throw Error('missing action plans');
 const map=new Map();
 for(const p of plans){
  if(typeof p.alternativeId!=='string'||map.has(p.alternativeId)||!evaluation.alternatives.some(a=>a.id===p.alternativeId)||!['renew','resize','renegotiate','replace','cancel','consolidate'].includes(p.action)||!Array.isArray(p.removeIds))throw Error('invalid action plan');
  if(['replace','cancel','consolidate'].includes(p.action)&&!p.removeIds.length)throw Error('removal scope required');
  map.set(p.alternativeId,p);
 }
 const alternatives=evaluation.alternatives.map(a=>{
  const p=map.get(a.id);
  const dependency=p.removeIds.length?assessDependencyImpact({...graph,removeIds:p.removeIds}):null;
  const review=adaptiveReviewHint({objective:evaluation.objective,action:p.action,feedback});
  // Even a graph with no affected nodes cannot establish safe removal.
  const reviewBlocked=!a.eligible||dependency!==null;
  return {...a,action:p.action,dependency,history:review,reviewBlocked,eligible:a.eligible&&!reviewBlocked,reason:dependency?'dependency_review_required':a.reason};
 });
 const best=alternatives.filter(a=>a.eligible&&BigInt(a.netSavingsMinor)>0n).sort((a,b)=>BigInt(a.totalMinor)<BigInt(b.totalMinor)?-1:BigInt(a.totalMinor)>BigInt(b.totalMinor)?1:a.id<b.id?-1:a.id>b.id?1:0)[0];
 return {...evaluation,alternatives,suggestedAlternativeId:evaluation.objective==='efficiency'?(best?.id??null):null,status:'requires_human_review'};
}
