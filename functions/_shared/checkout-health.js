// Internal aggregate diagnostics; deliberately not exposed as a public route.
export async function checkoutHealth(db,t=Date.now()){
 const row=await db.prepare(`SELECT
 (SELECT count(*) FROM checkout_provider_claims WHERE completed_at IS NULL AND claimed_at<?) AS stale_claims,
 (SELECT count(*) FROM checkout_intents WHERE status='created' AND expires_at<?) AS expired_pending,
 (SELECT count(*) FROM checkout_intents c LEFT JOIN payment_ledger p ON p.payment_id=c.payment_id WHERE c.status='paid' AND (p.payment_id IS NULL OR p.link_id<>c.link_id OR p.amount<>c.amount OR p.currency<>c.currency OR p.customer_email<>c.owner_email OR p.tier<>c.tier)) AS ledger_mismatches,
 (SELECT count(*) FROM checkout_intents WHERE founding_slot IS NOT NULL)+(SELECT count(*) FROM legacy_founding_allocations) AS allocated
 `).bind(t-900000,t).first();
 if(!row||!['stale_claims','expired_pending','ledger_mismatches','allocated'].every(k=>Number.isSafeInteger(row[k])&&row[k]>=0)||row.allocated>25)throw Error('checkout_health_invalid');
 return {...row,remaining:25-row.allocated,requiresReview:row.stale_claims+row.expired_pending+row.ledger_mismatches>0};
}
