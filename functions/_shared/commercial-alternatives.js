// Compare explicit same-scope, same-period alternatives in minor units.
export function compareAlternatives(baseline,alternatives){
 const valid=x=>Number.isSafeInteger(x)&&x>=0;
 const cost=a=>{if(![a.recurringMinor,a.exitMinor,a.migrationMinor,a.overlapMinor].every(valid))throw Error('invalid cost');return [a.recurringMinor,a.exitMinor,a.migrationMinor,a.overlapMinor].reduce((s,n)=>s+BigInt(n),0n);};
 const base=cost(baseline);
 return alternatives.map(a=>{
 if(!['scopeKey','currency','periodKey'].every(k=>typeof baseline[k]==='string'&&baseline[k]&&baseline[k]===a[k]))throw Error('incomparable alternative');
 const total=cost(a);return {id:a.id,currency:a.currency,totalMinor:total.toString(),netSavingsMinor:(base-total).toString(),status:'identified'};
 });
}
