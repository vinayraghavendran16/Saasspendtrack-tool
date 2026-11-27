export function summarizeCostBases(rows){
 const totals=new Map(),seen=new Set();
 for(const r of rows){
 if(!['commitment','invoice','payment','expense_allocation'].includes(r.basis)||!['seat','platform','consumption','service','maintenance','implementation','support','tax','discount','other'].includes(r.component)||!/^[A-Z]{3}$/.test(r.currency)||!Number.isSafeInteger(r.amountMinor)||!r.sourceRef||!r.sourceLineKey||!['assumption','quoted','verified'].includes(r.evidence))throw Error('invalid cost fact');
 const id=JSON.stringify([r.basis,r.sourceRef,r.sourceLineKey]);if(seen.has(id))throw Error('duplicate fact');seen.add(id);
 const k=JSON.stringify([r.basis,r.currency,r.component,r.evidence]);totals.set(k,(totals.get(k)||0n)+BigInt(r.amountMinor));
 }
 return [...totals].map(([k,v])=>{const [basis,currency,component,evidence]=JSON.parse(k);return {basis,currency,component,evidence,amountMinor:String(v)};});
}
