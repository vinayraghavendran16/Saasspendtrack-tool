const DAY=86400000;
export function calendarDay(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const t=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===value?t:null;
}
export function deadlineMilestone({today,deadline,kind}){
 const t=calendarDay(today),d=calendarDay(deadline);
 if(t===null||d===null)return null;
 const remaining=(d-t)/DAY;
 const thresholds=kind==='notice'?[30,14,7,3,1,0]:kind==='renewal'?[90,60,30,14,7,1,0]:null;
 if(!thresholds)return null;
 if(remaining<0)return kind==='notice'&&remaining===-1?{milestone:-1,remaining}:null;
 const milestone=thresholds.filter(n=>n>=remaining).at(-1);
 return milestone===undefined?null:{milestone,remaining};
}
export function noticeDeadline(renewal,noticeDays){
 const t=calendarDay(renewal);
 if(t===null||!Number.isInteger(noticeDays)||noticeDays<0||noticeDays>3660)return null;
 return new Date(t-noticeDays*DAY).toISOString().slice(0,10);
}
