// Requires reviewed schema migration before enabling cadence.
export async function claimTrialDelivery(db,email,kind,t){
 if(!['day2','day4','day6','expired'].includes(kind)||!Number.isSafeInteger(t))throw Error('invalid claim');
 const id=crypto.randomUUID();
 const row=await db.prepare("INSERT INTO trial_delivery_claims(email,kind,id,claimed_at,status) SELECT email,?,?,?,'claimed' FROM users WHERE email=? AND paid_at IS NULL AND ((?='expired' AND status='expired' AND trial_ends_at<=?) OR (?<>'expired' AND status='trial' AND trial_ends_at>?)) AND NOT EXISTS(SELECT 1 FROM email_log WHERE email=users.email AND kind=?) ON CONFLICT(email,kind) DO NOTHING RETURNING id").bind(kind,id,t,email,kind,t,kind,t,kind).first();
 return row?.id===id?id:null;
}
export async function finishTrialDelivery(db,email,kind,id,accepted,t){
 if(accepted!==true&&accepted!==false)throw Error('invalid outcome');
 const status=accepted?'accepted':'review';
 const row=await db.prepare("UPDATE trial_delivery_claims SET status=?,finished_at=? WHERE email=? AND kind=? AND id=? AND status='claimed' RETURNING id").bind(status,t,email,kind,id).first();
 return row?.id===id;
}
