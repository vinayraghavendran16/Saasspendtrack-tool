// Compare approved baseline with observed net invoice facts for the identical scope and period.
export function reconcileSavings({baselineMinor,currency,scopeKey,periodKey,facts}){
 if(!Number.isSafeInteger(baselineMinor)||baselineMinor<0||!/^[A-Z]{3}$/.test(currency)||!scopeKey||!periodKey||!Array.isArray(facts)||!facts.length)throw Error('missing reconciliation evidence');
 const seen=new Set();let actual=0n;
 for(const f of facts){
 if(typeof f.id!=='string'||!f.id||seen.has(f.id)||f.currency!==currency||f.scopeKey!==scopeKey||f.periodKey!==periodKey||!['invoice','credit'].includes(f.kind)||!Number.isSafeInteger(f.amountMinor)||f.amountMinor<0)throw Error('invalid evidence');
 seen.add(f.id);actual+=BigInt(f.amountMinor)*(f.kind==='credit'?-1n:1n);
 }
 return {currency,actualMinor:actual.toString(),varianceMinor:(BigInt(baselineMinor)-actual).toString(),evidenceIds:[...seen],status:'requires_review'};
}
