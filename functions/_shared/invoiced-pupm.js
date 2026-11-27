export function invoicedPupm(rows,count){
 if(!Array.isArray(rows)||rows.length>10000||!Number.isSafeInteger(count)||count<=0)throw Error('invalid inputs');
 const totals=new Map();
 for(const r of rows){
 if(!['invoice','credit'].includes(r.kind)||!/^[A-Z]{3}$/.test(r.currency)||typeof r.amount_minor!=='string'||!/^\d{1,19}$/.test(r.amount_minor))throw Error('invalid ledger fact');
 const amount=BigInt(r.amount_minor)*(r.kind==='credit'?-1n:1n);
 totals.set(r.currency,(totals.get(r.currency)??0n)+amount);
 }
 return [...totals].sort(([a],[b])=>a.localeCompare(b)).map(([currency,amount])=>({currency,amountMinor:String(amount),pupmMinor:{numerator:String(amount),denominator:String(count)}}));
}
