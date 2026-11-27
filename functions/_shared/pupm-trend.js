export function trendMonths(end,count){
 if(typeof end!=='string'||!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(end)||!Number.isInteger(count)||count<1||count>12)throw Error('invalid range');
 const [y,m]=end.split('-').map(Number),last=y*12+m-1;
 if(last-count+1<12)throw Error('invalid year');
 return Array.from({length:count},(_,i)=>{const n=last-count+1+i;return String(Math.floor(n/12)).padStart(4,'0')+'-'+String(n%12+1).padStart(2,'0');});
}
export function changeBasisPoints(previous,current){
 if(!previous||!current||previous.currency!==current.currency)return null;
 const a=BigInt(previous.pupmMinor.numerator),b=BigInt(previous.pupmMinor.denominator),c=BigInt(current.pupmMinor.numerator),d=BigInt(current.pupmMinor.denominator);
 if(a<=0n||b<=0n||d<=0n||c<0n)return null;
 return String((c*b-a*d)*10000n/(a*d));
}
