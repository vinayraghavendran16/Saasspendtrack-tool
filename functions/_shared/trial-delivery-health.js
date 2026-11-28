export async function trialDeliveryHealth(db,t=Date.now()){
 if(!Number.isSafeInteger(t)||t<0)throw Error('invalid clock');
 const row=await db.prepare("SELECT COUNT(CASE WHEN status='review' THEN 1 END) AS review, COUNT(CASE WHEN status='claimed' AND claimed_at<=? THEN 1 END) AS stale, COUNT(CASE WHEN status='accepted' AND NOT EXISTS(SELECT 1 FROM email_log l WHERE l.email=c.email AND l.kind=c.kind) THEN 1 END) AS unlogged FROM trial_delivery_claims c").bind(t-900000).first();
 if(!row||!['review','stale','unlogged'].every(k=>Number.isSafeInteger(row[k])&&row[k]>=0))throw Error('invalid health result');
 return {review:row.review,stale:row.stale,unlogged:row.unlogged,requiresReview:row.review+row.stale+row.unlogged>0};
}
