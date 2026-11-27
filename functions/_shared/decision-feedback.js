// Descriptive outcome history, not causal inference or reinforcement learning.
// Caller must load only the authenticated workspace's approved, verified outcomes.
export function summarizeDecisionFeedback(rows){
 if(!Array.isArray(rows)||rows.length>10000)throw Error('invalid outcomes');
 const seen=new Set(),groups=new Map();
 for(const r of rows){
  if(typeof r.decisionId!=='string'||!r.decisionId||!Number.isSafeInteger(r.revision)||r.revision<1||typeof r.action!=='string'||!r.action||!['efficiency','growth','risk'].includes(r.objective)||!['met','unmet','unknown'].includes(r.outcome)||r.evidence!=='verified')throw Error('invalid outcome');
  const id=JSON.stringify([r.decisionId,r.revision]);if(seen.has(id))throw Error('duplicate decision outcome');seen.add(id);
  const key=JSON.stringify([r.objective,r.action]);const g=groups.get(key)||{objective:r.objective,action:r.action,met:0,unmet:0,unknown:0};
  g[r.outcome]++;groups.set(key,g);
 }
 return [...groups.values()].map(g=>{const n=g.met+g.unmet;return {...g,observed:n,observedSuccessRate:n>=10?g.met/n:null,status:n>=10?'descriptive_only':'insufficient_evidence'};});
}
