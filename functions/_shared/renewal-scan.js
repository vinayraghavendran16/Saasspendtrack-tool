import {planRenewals} from './renewal-planner.js';
import {enqueueRenewals} from './renewal-queue.js';
export async function scanAccountRenewals(db,accountId,today){
 const [c,a,m]=await db.batch([
 db.prepare('SELECT c.id,c.end_date,c.notice_date,o.vendor_id FROM commercial_contracts c LEFT JOIN contract_ownership_mapping o ON o.account_id=c.account_id AND o.contract_id=c.id WHERE c.account_id=? LIMIT 1001').bind(accountId),
 db.prepare('SELECT * FROM vendor_ownership WHERE account_id=? LIMIT 5001').bind(accountId),
 db.prepare('SELECT email,status,role FROM memberships WHERE account_id=? LIMIT 501').bind(accountId)]);
 if(c.results.length>1000||a.results.length>5000||m.results.length>500)throw Error('renewal_scan_limit');
 const plan=planRenewals({today,contracts:c.results,assignments:a.results,members:m.results});
 return {inserted:await enqueueRenewals(db,accountId,plan.jobs),unroutable:plan.unroutable};
}
