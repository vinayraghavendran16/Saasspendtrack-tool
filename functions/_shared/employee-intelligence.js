export async function pseudonymousSubject(key,accountId,sourceId,providerSubject){
 if(!(key instanceof Uint8Array)||key.length<32||![accountId,sourceId,providerSubject].every(v=>typeof v==='string'&&v.length>0&&v.length<=1024))throw Error('invalid_subject_input');
 const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(JSON.stringify(['sst-employee-v1',accountId,sourceId,providerSubject])));
 return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
}
export function lifecycleState(rows,now,maxAge){
 const state=kind=>{
 const fresh=rows.filter(r=>r.source_kind===kind&&Number.isSafeInteger(r.observed_at)&&r.observed_at<=now&&now-r.observed_at<=maxAge);
 const statuses=new Set(fresh.map(r=>r.status));
 return statuses.size===1&&['active','inactive'].includes([...statuses][0])?[...statuses][0]:'unknown';
 };
 const employment=state('hrms'),directory=state('idp');
 return {employment,directory,reviewRequired:employment==='inactive'&&directory==='active'};
}
