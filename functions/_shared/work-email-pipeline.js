// Read-only reporting: never filter or mutate the stored users table.
// Consumer-domain screening is a heuristic, not verification of buying intent.
export const PERSONAL_DOMAINS = Object.freeze([
 'gmail.com','googlemail.com','yahoo.com','yahoo.co.in','yahoo.in','yahoo.co.uk','ymail.com','rocketmail.com',
 'outlook.com','outlook.in','hotmail.com','hotmail.co.uk','hotmail.fr','live.com','live.co.uk','msn.com',
 'icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','pm.me','tutanota.com','tuta.com',
 'tutamail.com','fastmail.com','hey.com','mail.com','email.com','gmx.com','gmx.net','gmx.de',
 'rediffmail.com','rediff.com','zoho.com','zohomail.com','yandex.com','yandex.ru','mail.ru',
 'qq.com','163.com','126.com','naver.com','daum.net','hanmail.net','comcast.net','att.net',
 'verizon.net','sbcglobal.net','bellsouth.net','btinternet.com','orange.fr','laposte.net','free.fr',
 'mailinator.com','yopmail.com','guerrillamail.com','10minutemail.com','tempmail.com','dispostable.com'
]);
const normalize=value=>String(value||'').trim().toLowerCase();
const list=value=>Array.isArray(value)?value:String(value||'').split(',');
export function workEmailPipeline(users,{nowMs=Date.now(),annualListPriceINR=300000,excludedEmails=[],excludedDomains=[]}={}) {
 if(!Number.isFinite(nowMs)||!Number.isFinite(annualListPriceINR)||annualListPriceINR<0)throw new TypeError('Invalid reporting time or list price');
 const blocked=new Set([...PERSONAL_DOMAINS,...list(excludedDomains)].map(normalize).filter(Boolean));
 const internal=new Set(list(excludedEmails).map(normalize).filter(Boolean));
 const summary={activeWorkEmailTrials:0,verifiedWorkEmailTrials:0,excludedPersonal:0,excludedInternal:0,excludedInvalid:0,unverified:0,duplicateRows:0,potentialAnnualINR:0};
 const seen=new Set();
 for(const u of users) {
  // Match the existing admin report's effective trial status exactly.
  if(u.status!=='trial'||!Number.isFinite(Number(u.trial_ends_at))||Number(u.trial_ends_at)<=nowMs)continue;
  const email=normalize(u.email);
  if(internal.has(email)){summary.excludedInternal++;continue;}
  const match=/^[^\s@]+@([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/.exec(email);
  const domain=match?.[1];
  if(!domain||!domain.includes('.')||domain.split('.').some(label=>!label||label.startsWith('-')||label.endsWith('-'))||/(^|\.)(example\.(com|net|org)|test|invalid|localhost)$/.test(domain)) {summary.excludedInvalid++;continue;}
  if([...blocked].some(d=>domain===d||domain.endsWith('.'+d))){summary.excludedPersonal++;continue;}
  if(seen.has(email)){summary.duplicateRows++;continue;} seen.add(email);
  summary.activeWorkEmailTrials++;
  // Signup requests create rows before verification; require an actual successful login.
  const login=Number(u.last_login_at);
  if(!Number.isFinite(login)||login<=0||login>nowMs){summary.unverified++;continue;}
  summary.verifiedWorkEmailTrials++;
 }
 summary.potentialAnnualINR=summary.verifiedWorkEmailTrials*annualListPriceINR;
 return summary;
}
