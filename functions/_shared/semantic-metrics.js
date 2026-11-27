const cycles=Object.freeze({weekly:52,monthly:12,quarterly:4,yearly:1});
const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
export function recurringCost({amount,currency,cycle}={}){
 if(!valid(amount)||typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency)||!Object.hasOwn(cycles,cycle))return null;
 const annual=amount*cycles[cycle];if(!Number.isFinite(annual))return null;
 return {currency,annual,monthly:annual/12,basis:'run_rate',definitionVersion:1};
}
export function pupm({monthly,currency,denominator,count}={}){
 if(!valid(monthly)||typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency)||!['purchased_seats','assigned_users','active_users','employees'].includes(denominator)||!Number.isSafeInteger(count)||count<=0)return null;
 return {currency,amount:monthly/count,denominator,count,basis:'run_rate',definitionVersion:1};
}
export function licenceCounts({purchased,assigned,utilized}={}){
 if(!Number.isSafeInteger(purchased)||purchased<=0)return null;
 const known=n=>Number.isSafeInteger(n)&&n>=0&&n<=purchased;
 return {purchased,unassigned:known(assigned)?purchased-assigned:null,unused:known(utilized)?purchased-utilized:null};
}
