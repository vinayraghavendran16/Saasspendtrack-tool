// Only verified additive seat changes with explicit line identity; repricing requires separate review.
export function reconcileAmendments({asOf,baseline,changes}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf))throw Error('invalid date');
 const lines=new Map(),seen=new Set(),review=[];
 for(const l of baseline){if(!l.id||lines.has(l.id)||!Number.isSafeInteger(l.quantity)||l.quantity<0)throw Error('invalid baseline');lines.set(l.id,{...l});}
 for(const c of [...changes].sort((a,b)=>String(a.effectiveDate).localeCompare(String(b.effectiveDate)))){
 if(!c.id||seen.has(c.id)||!/^\d{4}-\d{2}-\d{2}$/.test(c.effectiveDate))throw Error('invalid change');seen.add(c.id);
 if(c.effectiveDate>asOf)continue;
 const l=lines.get(c.lineId);
 if(c.verification!=='verified'||!l||c.kind!=='quantity_delta'||c.currency!==l.currency||c.skuId!==l.skuId||!Number.isSafeInteger(c.delta)){review.push(c.id);continue;}
 const q=l.quantity+c.delta;if(!Number.isSafeInteger(q)||q<0)throw Error('invalid quantity');l.quantity=q;
 }
 return {lines:[...lines.values()],review,complete:review.length===0};
}
