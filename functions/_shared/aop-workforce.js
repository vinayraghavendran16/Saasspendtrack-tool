// Monthly department aggregates; transfers must balance across departments.
export function projectWorkforce(opening,months){
 const counts=new Map(Object.entries(opening));
 const valid=n=>Number.isSafeInteger(n)&&n>=0;
 if([...counts.values()].some(n=>!valid(n)))throw Error('invalid opening');
 return months.map((rows,index)=>{
  let incoming=0,outgoing=0;const seen=new Set(),next=new Map(counts);
  for(const r of rows){
   if(!counts.has(r.department)||seen.has(r.department)||![r.hires,r.exits,r.transferIn,r.transferOut].every(valid))throw Error('invalid movement');
   seen.add(r.department);incoming+=r.transferIn;outgoing+=r.transferOut;
   const n=counts.get(r.department)+r.hires-r.exits+r.transferIn-r.transferOut;
   if(!valid(n))throw Error('invalid closing headcount');next.set(r.department,n);
  }
  if(incoming!==outgoing)throw Error('unbalanced transfers');
  const result={month:index+1,opening:Object.fromEntries(counts),closing:Object.fromEntries(next)};
  for(const [k,v] of next)counts.set(k,v);return result;
 });
}
