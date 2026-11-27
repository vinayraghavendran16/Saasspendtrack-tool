export function fixedCosts(rows,months){
 const seen=new Set();
 return rows.map(r=>{
 if(typeof r.id!=='string'||!r.id||!months.includes(r.month)||!/^[A-Z]{3}$/.test(r.currency)||!Number.isSafeInteger(r.amountMinor)||r.amountMinor<0)throw Error('invalid fixed cost');
 const k=JSON.stringify([r.id,r.month]);if(seen.has(k))throw Error('duplicate fixed cost');seen.add(k);
 return {month:r.month,currency:r.currency,expenseMinor:String(r.amountMinor),sourceId:r.id};
 });
}
