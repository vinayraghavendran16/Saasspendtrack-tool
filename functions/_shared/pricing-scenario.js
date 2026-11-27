import {priceComponent,priceTiered} from './commercial-pricing.js';
export function comparePricing({currency,quantities,offers}={}){
 if(!/^[A-Z]{3}$/.test(currency||'')||!Array.isArray(quantities)||!quantities.length||quantities.length>100||!Array.isArray(offers)||!offers.length||offers.length>30||new Set(offers.map(o=>o.id)).size!==offers.length)throw Error('invalid scenario');
 return quantities.map(quantity=>{
 if(!Number.isSafeInteger(quantity)||quantity<0)throw Error('invalid quantity');
 const options=offers.map(o=>{
 if(typeof o.id!=='string'||!o.id||o.currency!==currency||!Number.isSafeInteger(o.minimumMinor??0)||(o.minimumMinor??0)<0)throw Error('invalid offer');
 let total;
 if(o.tiers)total=BigInt(priceTiered({...o,quantity}).amountMinor);
 else {if(!Array.isArray(o.components)||!o.components.length||o.components.length>30)throw Error('invalid components');total=o.components.reduce((sum,c)=>sum+BigInt(priceComponent({...c,quantity}).amountMinor),0n);const minimum=BigInt(o.minimumMinor??0);if(total<minimum)total=minimum;}
 return {id:o.id,monthlyMinor:String(total),annualMinor:String(total*12n)};
 }).sort((a,b)=>BigInt(a.monthlyMinor)<BigInt(b.monthlyMinor)?-1:BigInt(a.monthlyMinor)>BigInt(b.monthlyMinor)?1:0);
 return {quantity,currency,options,basis:'scenario_estimate'};
 });
}
