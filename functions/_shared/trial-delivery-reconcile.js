// Only repairs logs for claims already marked accepted by the provider.
export async function repairAcceptedTrialLogs(db){
 const result=await db.prepare("INSERT OR IGNORE INTO email_log(email,kind,sent_at) SELECT c.email,c.kind,c.finished_at FROM trial_delivery_claims c WHERE c.status='accepted' AND NOT EXISTS(SELECT 1 FROM email_log l WHERE l.email=c.email AND l.kind=c.kind) ORDER BY c.finished_at,c.id LIMIT 500").run();
 if(!Number.isSafeInteger(result.meta?.changes)||result.meta.changes<0||result.meta.changes>500)throw Error('invalid repair result');
 return result.meta.changes;
}
