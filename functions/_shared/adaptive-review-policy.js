// Conservative review hint; never changes eligibility, approval or financial ranking.
export function adaptiveReviewHint({objective,action,feedback}){
 if(!['efficiency','growth','risk'].includes(objective)||typeof action!=='string'||!action||!Array.isArray(feedback))throw Error('invalid review context');
 const matches=feedback.filter(x=>x.objective===objective&&x.action===action);
 if(matches.length>1)throw Error('duplicate feedback group');
 const row=matches[0];
 if(!row)return {hint:'insufficient_evidence',changesRecommendation:false};
 if(![row.met,row.unmet,row.unknown].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('invalid counts');
 const n=row.met+row.unmet;
 if(!Number.isSafeInteger(n)||n<10)return {hint:'insufficient_evidence',changesRecommendation:false};
 // Wilson lower bound: descriptive uncertainty, not causal prediction.
 const p=row.met/n,z=1.96,z2=z*z;
 const lower=(p+z2/(2*n)-z*Math.sqrt((p*(1-p)+z2/(4*n))/n))/(1+z2/n);
 return {hint:lower>=.6?'review_positive_history':p<.5?'review_prior_failures':'review_mixed_history',observations:n,observedRate:p,lowerBound:lower,changesRecommendation:false,attribution:'not_established'};
}
