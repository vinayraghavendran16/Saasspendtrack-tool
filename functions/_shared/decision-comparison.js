// Compare revisions only within the same financial scope and objective.
export function compareDecisionRevisions(previous,current){
 for(const k of ['scopeKey','periodKey','currency','objective'])if(typeof previous[k]!=='string'||!previous[k]||previous[k]!==current[k])throw Error('incomparable revisions');
 const money=v=>{if(typeof v!=='string'||!/^\d{1,40}$/.test(v))throw Error('invalid cost');return BigInt(v);};
 const index=d=>{const m=new Map();for(const a of d.alternatives){if(typeof a.id!=='string'||!a.id||m.has(a.id)||typeof a.eligible!=='boolean')throw Error('invalid alternative');money(a.totalMinor);m.set(a.id,a);}return m;};
 const a=index(previous),b=index(current);
 return {currency:current.currency,baselineDeltaMinor:(money(current.baselineMinor)-money(previous.baselineMinor)).toString(),alternatives:[...new Set([...a.keys(),...b.keys()])].sort().map(id=>{const x=a.get(id),y=b.get(id);return {id,previousMinor:x?.totalMinor??null,currentMinor:y?.totalMinor??null,deltaMinor:x&&y?(money(y.totalMinor)-money(x.totalMinor)).toString():null,previousEligible:x?.eligible??null,currentEligible:y?.eligible??null,status:!x?'added':!y?'removed':'compared'};}),previousSuggestion:previous.suggestedAlternativeId,currentSuggestion:current.suggestedAlternativeId};
}
