export function classifyLicence({employment,directory,assignment,usage,now,maxAge}){
 const fresh=r=>r&&Number.isSafeInteger(r.observed_at)&&r.observed_at<=now&&now-r.observed_at<=maxAge;
 if(!fresh(assignment)||assignment.status!=='assigned')return 'unknown';
 if(employment==='inactive')return 'departure_review';
 if(directory==='inactive')return 'disabled_account_review';
 if(employment!=='active'||!fresh(usage))return 'unknown';
 return usage.status==='inactive'?'usage_review':usage.status==='active'?'in_use':'unknown';
}
