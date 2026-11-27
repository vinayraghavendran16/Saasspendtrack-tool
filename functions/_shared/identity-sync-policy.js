export function acceptObservation(previous,next,now){
 if(!next||!['active','inactive','unknown'].includes(next.status)||!Number.isSafeInteger(next.observed_at)||next.observed_at>now)return false;
 if(!previous)return true;
 return next.observed_at>previous.observed_at;
}
export function effectiveObservation(row,now,maxAge){
 if(!row||!Number.isSafeInteger(row.observed_at)||row.observed_at>now||now-row.observed_at>maxAge)return 'unknown';
 return ['active','inactive'].includes(row.status)?row.status:'unknown';
}
