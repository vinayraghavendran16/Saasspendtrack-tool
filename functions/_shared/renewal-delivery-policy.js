export function eligibleRenewalRecipient({job,membership,route,deadlineAt,now}){
 return !!(job&&membership&&route&&membership.account_id===job.account_id&&membership.email===job.recipient_email&&membership.status==='active'&&route.recipients.includes(job.recipient_email)&&Number.isSafeInteger(deadlineAt)&&deadlineAt===job.deadline_at&&Number.isSafeInteger(now)&&job.created_at<=now);
}
