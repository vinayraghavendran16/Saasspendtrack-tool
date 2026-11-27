export async function enqueueRenewals(db,accountId,jobs){
 let inserted=0;
 for(let i=0;i<jobs.length;i+=50){
  const batch=jobs.slice(i,i+50).map(j=>db.prepare("INSERT INTO governance_notifications(account_id,id,vendor_id,kind,deadline_at,milestone,recipient_email,status,next_attempt_at,created_at) VALUES(?,?,?,?,?,?,?,'pending',?,?) ON CONFLICT(account_id,vendor_id,kind,deadline_at,milestone,recipient_email) DO NOTHING").bind(accountId,crypto.randomUUID(),'contract:'+j.contractId,j.kind,j.deadlineAt,String(j.milestone),j.recipientEmail,Date.now(),Date.now()));
  for(const r of await db.batch(batch))inserted+=r.meta?.changes??0;
 }
 return inserted;
}
