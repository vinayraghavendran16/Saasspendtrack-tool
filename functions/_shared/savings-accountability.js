// Each approved alternative must carry a canonical economic exposure key.
export function summarizeSavings(rows){
 const used=new Set(),totals=new Map();
 for(const r of rows){
 if(!['approved','contracted','realized'].includes(r.status))continue;
 if(typeof r.exposureKey!=='string'||!r.exposureKey||used.has(r.exposureKey)||!/^[A-Z]{3}$/.test(r.currency)||!Number.isSafeInteger(r.amountMinor)||r.amountMinor<0)throw Error('invalid or overlapping savings');
 if(r.status==='realized'&&(typeof r.evidenceRef!=='string'||!r.evidenceRef.trim()))throw Error('realized savings requires evidence');
 used.add(r.exposureKey);const key=JSON.stringify([r.currency,r.status]);totals.set(key,(totals.get(key)||0n)+BigInt(r.amountMinor));
 }
 return [...totals].map(([k,v])=>{const [currency,status]=JSON.parse(k);return {currency,status,amountMinor:v.toString()};});
}
