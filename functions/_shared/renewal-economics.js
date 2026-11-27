export function renewalEconomics({currency,currentSeats,currentPupmMinor,proposedSeats,proposedPupmMinor,priceEvidence}){
 if(!/^[A-Z]{3}$/.test(currency)||![currentSeats,currentPupmMinor,proposedSeats,proposedPupmMinor].every(n=>Number.isSafeInteger(n)&&n>=0)||!['assumption','quote','signed'].includes(priceEvidence))throw Error('invalid economics');
 const current=BigInt(currentSeats)*BigInt(currentPupmMinor)*12n,proposed=BigInt(proposedSeats)*BigInt(proposedPupmMinor)*12n;
 return {currency,currentAnnualMinor:String(current),proposedAnnualMinor:String(proposed),annualDeltaMinor:String(proposed-current),breakEvenPupmMinor:proposedSeats?String(current/(BigInt(proposedSeats)*12n)):null,priceEvidence,realized:false};
}
