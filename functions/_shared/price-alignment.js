export function priceAlignment(a,b){
 const keys=['skuId','currency','comparisonKey','billingPeriod'];
 if(!a||!b||keys.some(k=>typeof a[k]!=='string'||!a[k]||a[k]!==b[k])||a.resellerId===b.resellerId)return null;
 if(![a.unitPriceMinor,b.unitPriceMinor,a.quantity].every(n=>Number.isSafeInteger(n)&&n>=0)||a.unitPriceMinor<=b.unitPriceMinor||a.quantity===0)return null;
 const multiplier=a.billingPeriod==='annual'?1:a.billingPeriod==='monthly'?12:0;
 if(!multiplier)return null;
 return {currency:a.currency,annualPotentialMinor:(BigInt(a.unitPriceMinor-b.unitPriceMinor)*BigInt(a.quantity)*BigInt(multiplier)).toString(),status:'identified',requiresQuote:true};
}
