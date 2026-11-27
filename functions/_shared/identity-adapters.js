export function projectEntraUser(row){
 if(!row||typeof row.id!=='string'||!row.id||row.id.length>1024)throw Error('invalid_provider_subject');
 return {providerSubject:row.id,status:row.accountEnabled===true?'active':row.accountEnabled===false?'inactive':'unknown'};
}
export async function normalizeDirectoryPage(rows,{key,accountId,sourceId,observedAt,pseudonymize}){
 if(!Array.isArray(rows)||rows.length>1000||!Number.isSafeInteger(observedAt))throw Error('invalid_page');
 return Promise.all(rows.map(async row=>{
 const p=projectEntraUser(row);
 return {pseudonymous_ref:await pseudonymize(key,accountId,sourceId,p.providerSubject),source_kind:'idp',status:p.status,observed_at:observedAt};
 }));
}
