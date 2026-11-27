// Mutually exclusive seat classifications, not inferred solely from logins.
export function licenceDemand({purchased,active,protectedSeats,unknown,reusable,plannedAdditions}){
 if(![purchased,active,protectedSeats,unknown,reusable,plannedAdditions].every(n=>Number.isSafeInteger(n)&&n>=0)||BigInt(active)+BigInt(protectedSeats)+BigInt(unknown)+BigInt(reusable)!==BigInt(purchased))throw Error('invalid seat classification');
 return {reusableSeats:reusable,additionalSeats:Math.max(0,plannedAdditions-reusable),potentialAvoidedPurchases:Math.min(plannedAdditions,reusable),status:'planning_only'};
}
