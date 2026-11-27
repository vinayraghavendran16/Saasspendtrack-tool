// Inputs must be tenant-scoped, audited records from a consistent snapshot.
export function summarizeRenewalAI({publications,actions,challenges,resolutions,start,end,asOf}){
 if(![start,end,asOf].every(Number.isSafeInteger)||start<0||end<=start||asOf<end)throw Error('invalid cohort window');
 for(const rows of [publications,actions,challenges,resolutions])if(!Array.isArray(rows)||rows.length>10000)throw Error('invalid or oversized cohort');
 const key=r=>JSON.stringify([r.recommendation_id,r.revision]);
 const cohort=new Map(),seen=new Set();
 for(const p of publications){
 if(p.published_at<start||p.published_at>=end||!p.contract_id)continue;
 const k=key(p);if(seen.has(k))throw Error('duplicate publication');seen.add(k);
 const prev=cohort.get(p.recommendation_id);
 if(!prev||p.revision>prev.revision)cohort.set(p.recommendation_id,p);
 }
 const byKey=new Map([...cohort.values()].map(p=>[key(p),{p,actions:[],challenges:[]}]));
 const ids=new Set();
 for(const a of actions){
 const row=byKey.get(key(a));if(!row||a.occurred_at>asOf||a.occurred_at<row.p.published_at)continue;
 if(ids.has(a.id))throw Error('duplicate action');ids.add(a.id);row.actions.push(a);
 }
 const challengeIds=new Set(),resolved=new Map();
 for(const r of resolutions){if(r.resolved_at>asOf)continue;if(resolved.has(r.challenge_id))throw Error('duplicate resolution');resolved.set(r.challenge_id,r);}
 for(const c of challenges){const row=byKey.get(key(c));if(!row||c.challenged_at>asOf||c.challenged_at<row.p.published_at)continue;if(challengeIds.has(c.id))throw Error('duplicate challenge');challengeIds.add(c.id);row.challenges.push(c);}
 const result={recommendations:cohort.size,responded:0,accepted:0,rejected:0,deferred:0,challenged:0,challengeCount:0,resolvedChallenges:0,blockingChallenges:0,everApproved:0,everExecutionRecorded:0};
 const times=[];
 for(const row of byKey.values()){
 const decisions=row.actions.filter(a=>['accept','reject','defer'].includes(a.action)).sort((a,b)=>a.occurred_at-b.occurred_at||String(a.id).localeCompare(String(b.id)));
 if(decisions.length){result.responded++;times.push(decisions[0].occurred_at-row.p.published_at);const last=decisions.at(-1);const tied=decisions.filter(a=>a.occurred_at===last.occurred_at);if(new Set(tied.map(a=>a.action)).size===1)result[{accept:'accepted',reject:'rejected',defer:'deferred'}[last.action]]++;}
 if(row.actions.some(a=>a.action==='approve'))result.everApproved++;
 if(row.actions.some(a=>a.action==='execute'))result.everExecutionRecorded++;
 if(row.challenges.length)result.challenged++;
 for(const c of row.challenges){result.challengeCount++;const r=resolved.get(c.id);if(r&&r.resolved_at>=c.challenged_at)result.resolvedChallenges++;if(!r||r.resolved_at<c.challenged_at||r.disposition!=='upheld')result.blockingChallenges++;}
 }
 const rate=(n,d)=>d? n/d:null;
 times.sort((a,b)=>a-b);const m=Math.floor(times.length/2);
 return {...result,ambiguousResponses:result.responded-result.accepted-result.rejected-result.deferred,responseRate:rate(result.responded,result.recommendations),acceptanceRateAmongResponded:rate(result.accepted,result.responded),challengeRate:rate(result.challenged,result.recommendations),resolutionRate:rate(result.resolvedChallenges,result.challengeCount),medianFirstResponseMs:times.length?(times.length%2?times[m]:(times[m-1]+times[m])/2):null,definitionVersion:1,cohortBasis:'latest_revision_published_within_window',asOf,financialOutcomeStatus:'not_evaluated'};
}
