// Return exact rational minor units; never blend currencies or non-seat products.
export function effectivePupm(rows){
 const groups=new Map(),seen=new Set();
 for(const r of rows){
 if(r.unit!=='seat')continue;
 if(!r.id||seen.has(r.id)||!r.skuId||!r.period||!/^[A-Z]{3}$/.test(r.currency)||!Number.isSafeInteger(r.netRecurringMinor)||r.netRecurringMinor<0||!Number.isSafeInteger(r.seatMonths)||r.seatMonths<=0)throw Error('invalid seat cost');
 seen.add(r.id);const k=JSON.stringify([r.skuId,r.currency,r.period]);const g=groups.get(k)||[0n,0n];g[0]+=BigInt(r.netRecurringMinor);g[1]+=BigInt(r.seatMonths);groups.set(k,g);
 }
 return [...groups].map(([k,[n,d]])=>{const [skuId,currency,period]=JSON.parse(k);return {skuId,currency,period,numeratorMinor:String(n),denominatorSeatMonths:String(d)};});
}
