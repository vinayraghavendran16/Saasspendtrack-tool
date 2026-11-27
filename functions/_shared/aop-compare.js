export function compareScenarios(base,alternative){
 const index=rows=>{const m=new Map();for(const r of rows){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)||!/^[A-Z]{3}$/.test(r.currency)||typeof r.expenseMinor!=='string'||!/^\d+$/.test(r.expenseMinor))throw Error('invalid total');const k=JSON.stringify([r.month,r.currency]);if(m.has(k))throw Error('duplicate total');m.set(k,BigInt(r.expenseMinor));}return m;};
 const a=index(base.totals),b=index(alternative.totals);
 return [...new Set([...a.keys(),...b.keys()])].sort().map(k=>{const [month,currency]=JSON.parse(k);return {month,currency,baselineMinor:a.has(k)?a.get(k).toString():null,alternativeMinor:b.has(k)?b.get(k).toString():null,deltaMinor:a.has(k)&&b.has(k)?(b.get(k)-a.get(k)).toString():null};});
}
