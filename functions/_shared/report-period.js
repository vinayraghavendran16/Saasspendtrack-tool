export function reportPeriod(start,end,grain='month'){
 const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(!valid(start)||!valid(end)||start>end||!['month','quarter','year'].includes(grain))throw Error('invalid_period');
 return {start,end,grain};
}
export function calendarBucket(date,grain){
 reportPeriod(date,date,grain);
 const year=date.slice(0,4),month=Number(date.slice(5,7));
 return grain==='year'?year:grain==='quarter'?year+'-Q'+Math.ceil(month/3):date.slice(0,7);
}
