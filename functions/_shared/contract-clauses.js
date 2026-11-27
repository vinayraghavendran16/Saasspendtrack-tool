import {calendarDay} from './governance-deadlines.js';
export function contractRisk({start,end,notice,autoRenew,midtermReduction,escalation}){
 const s=calendarDay(start),e=calendarDay(end),n=notice==null?null:calendarDay(notice);
 if(s===null||e===null||e<s||(notice!=null&&(n===null||n>e)))throw Error('invalid term');
 if(!['yes','no','unknown'].includes(autoRenew)||!['yes','no','unknown'].includes(midtermReduction))throw Error('invalid clause');
 if(escalation&&(!['verified','quote','assumption'].includes(escalation.evidence)||!Number.isSafeInteger(escalation.basisPoints)||escalation.basisPoints<0))throw Error('invalid escalation');
 return {start,end,notice,autoRenew,midtermReduction,escalation:escalation??null,reviewRequired:autoRenew==='unknown'||(autoRenew==='yes'&&n===null)||midtermReduction==='unknown'||escalation?.evidence!=='verified'};
}
