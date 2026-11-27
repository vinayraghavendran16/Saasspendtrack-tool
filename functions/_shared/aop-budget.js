export function budgetVariance({currency,period,forecastMinor,budgetMinor,revenueMinor}){
 if(!/^[A-Z]{3}$/.test(currency)||typeof period!=='string'||!period||![forecastMinor,budgetMinor,revenueMinor].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('invalid budget');
 return {currency,period,headroomMinor:(BigInt(budgetMinor)-BigInt(forecastMinor)).toString(),spendRevenueBasisPoints:revenueMinor===0?null:(BigInt(forecastMinor)*10000n/BigInt(revenueMinor)).toString()};
}
