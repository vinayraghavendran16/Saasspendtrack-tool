// Monthly seat commitments; reductions require explicit contractual eligibility.
export function projectCommitments(lines){
 const seen=new Set();
 return lines.map(l=>{
 if(!l.poolId||!/^\d{4}-(0[1-9]|1[0-2])$/.test(l.month)||!/^[A-Z]{3}$/.test(l.currency)||![l.demand,l.committedSeats,l.unitMonthlyMinor].every(n=>Number.isSafeInteger(n)&&n>=0)||typeof l.reductionAllowed!=='boolean')throw Error('invalid commitment');
 const key=JSON.stringify([l.poolId,l.month]);if(seen.has(key))throw Error('duplicate pool');seen.add(key);
 const seats=Math.max(l.demand,l.reductionAllowed?0:l.committedSeats);
 return {poolId:l.poolId,month:l.month,currency:l.currency,billableSeats:seats,expenseMinor:(BigInt(seats)*BigInt(l.unitMonthlyMinor)).toString(),unusedCommittedSeats:Math.max(0,seats-l.demand)};
 });
}
