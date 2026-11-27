// Largest remainder allocation, deterministic tie-breaking by department ID.
export function allocateCost(amountMinor,weights){
 if(!Number.isSafeInteger(amountMinor)||amountMinor<0||!Array.isArray(weights)||!weights.length)throw Error('invalid allocation');
 const seen=new Set();let total=0n;
 for(const w of weights){if(typeof w.id!=='string'||!w.id||seen.has(w.id)||!Number.isSafeInteger(w.weight)||w.weight<0)throw Error('invalid weight');seen.add(w.id);total+=BigInt(w.weight);}
 if(total===0n)throw Error('zero allocation weights');
 const amount=BigInt(amountMinor),rows=weights.map(w=>{const n=amount*BigInt(w.weight);return {id:w.id,value:n/total,remainder:n%total};});
 let remaining=amount-rows.reduce((s,r)=>s+r.value,0n);
 rows.sort((a,b)=>a.remainder===b.remainder?(a.id<b.id?-1:a.id>b.id?1:0):a.remainder>b.remainder?-1:1);
 for(const r of rows){if(remaining===0n)break;r.value++;remaining--;}
 return rows.map(r=>({id:r.id,amountMinor:String(r.value)}));
}
