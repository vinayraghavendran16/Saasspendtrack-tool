// Inputs must be authorized, deduplicated monthly aggregates from canonical sources.
export function historicalPupm({costs,counts,denominator}={}){
 if(!Array.isArray(costs)||!Array.isArray(counts)||!['purchased_seats','assigned_users','active_users','employees'].includes(denominator))throw Error('invalid inputs');
 const key=r=>{if(typeof r.scope!=='string'||!r.scope||!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month))throw Error('invalid scope or period');return JSON.stringify([r.scope,r.month]);};
 const index=new Map();
 for(const r of counts){if(r.denominator!==denominator)continue;const k=key(r);if(index.has(k)||!Number.isSafeInteger(r.count)||r.count<0)throw Error('invalid count');index.set(k,r);}
 const seen=new Set();
 return costs.map(r=>{const k=key(r),id=JSON.stringify([k,r.currency,r.basis]);if(seen.has(id)||!/^[A-Z]{3}$/.test(r.currency)||!['invoiced','run_rate'].includes(r.basis)||typeof r.amountMinor!=='string'||!/^\d{1,30}$/.test(r.amountMinor))throw Error('invalid cost');seen.add(id);
 const c=index.get(k),available=!!c&&c.count>0;
 return {...r,denominator,count:c?.count??null,pupmMinor:available?{numerator:r.amountMinor,denominator:String(c.count)}:null,status:available?'available':'missing_or_zero_population'};
 });
}
