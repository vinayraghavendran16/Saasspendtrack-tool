import {calendarDay} from './governance-deadlines.js';
export function reconcileSchedule({currency,totalMinor,rows}){
 if(!/^[A-Z]{3}$/.test(currency)||!Number.isSafeInteger(totalMinor)||totalMinor<0)throw Error('invalid commitment');
 const seen=new Set();let sum=0n;
 for(const r of rows){
 if(!r.id||seen.has(r.id)||r.currency!==currency||calendarDay(r.dueDate)===null||!Number.isSafeInteger(r.amountMinor)||r.amountMinor<0)throw Error('invalid instalment');
 seen.add(r.id);sum+=BigInt(r.amountMinor);
 }
 return {currency,scheduledMinor:String(sum),unreconciledMinor:String(BigInt(totalMinor)-sum),balanced:sum===BigInt(totalMinor)};
}
