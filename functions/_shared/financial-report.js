import {reportPeriod,calendarBucket} from './report-period.js';
export function financialReport(facts,{start,end,grain='month',fiscalStartMonth=1}){
 reportPeriod(start,end,grain);
 if(!Number.isInteger(fiscalStartMonth)||fiscalStartMonth<1||fiscalStartMonth>12)throw Error('invalid_fiscal_start');
 const groups=new Map();
 for(const f of facts){
 reportPeriod(f.effective_date,f.effective_date,grain);
 if(f.effective_date<start||f.effective_date>end)continue;
 if(!Number.isSafeInteger(f.amount_minor)||f.amount_minor<0||!/^[A-Z]{3}$/.test(f.currency)||!['invoice','credit','budget'].includes(f.kind))throw Error('invalid_fact');
 const y=Number(f.effective_date.slice(0,4)),m=Number(f.effective_date.slice(5,7));
 const fy=y-(m<fiscalStartMonth?1:0),q=Math.floor(((m-fiscalStartMonth+12)%12)/3)+1;
 const bucket=grain==='month'?calendarBucket(f.effective_date,grain):'FY'+fy+(grain==='quarter'?'-Q'+q:'');
 const key=JSON.stringify([bucket,f.currency]);
 const g=groups.get(key)??{bucket,currency:f.currency,actual:0n,budget:0n};
 if(f.kind==='budget')g.budget+=BigInt(f.amount_minor);else g.actual+=BigInt(f.amount_minor)*(f.kind==='credit'?-1n:1n);
 groups.set(key,g);
 }
 return [...groups.values()].map(g=>({bucket:g.bucket,currency:g.currency,actualMinor:g.actual.toString(),budgetMinor:g.budget.toString(),varianceMinor:(g.actual-g.budget).toString()}));
}
