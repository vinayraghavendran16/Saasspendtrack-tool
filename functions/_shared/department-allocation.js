export function allocateDepartmentCost(amountMinor,weights){
 if(typeof amountMinor!=='string'||! /^-?\d{1,19}$/.test(amountMinor)||!Array.isArray(weights)||weights.length>500)throw Error('invalid allocation');
 const seen=new Set();let total=0;
 const rows=weights.map(w=>{
 if(!w||typeof w.departmentId!=='string'||!w.departmentId.trim()||w.departmentId.length>128||seen.has(w.departmentId)||!Number.isInteger(w.basisPoints)||w.basisPoints<1||w.basisPoints>10000)throw Error('invalid weight');
 seen.add(w.departmentId);total+=w.basisPoints;return {departmentId:w.departmentId,basisPoints:w.basisPoints};
 });
 if(total>10000)throw Error('overallocated');
 if(total<10000)rows.push({departmentId:null,basisPoints:10000-total});
 const amount=BigInt(amountMinor),abs=amount<0n?-amount:amount,sign=amount<0n?-1n:1n;
 let remaining=abs;
 for(const r of rows){const product=abs*BigInt(r.basisPoints);r.units=product/10000n;r.remainder=product%10000n;remaining-=r.units;}
 const ranked=[...rows].sort((a,b)=>a.remainder>b.remainder?-1:a.remainder<b.remainder?1:a.departmentId===null?1:b.departmentId===null?-1:a.departmentId<b.departmentId?-1:a.departmentId>b.departmentId?1:0);
 for(let i=0;remaining>0n;i++,remaining--)ranked[i].units++;
 return rows.map(r=>({departmentId:r.departmentId,basisPoints:r.basisPoints,amountMinor:String(r.units*sign)}));
}
