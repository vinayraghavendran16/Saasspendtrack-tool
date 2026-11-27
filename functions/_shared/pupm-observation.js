export function validateObservation(row,accountId){
 if(typeof accountId!=='string'||!accountId||row?.accountId!==accountId)throw Error('workspace mismatch');
 for(const k of ['scope','sourceId','sourceRecordId'])if(typeof row[k]!=='string'||!row[k].trim()||row[k].length>256)throw Error('invalid provenance');
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month)||!Number.isSafeInteger(row.recordedAt)||row.recordedAt<=0)throw Error('invalid period');
 if(!['purchased_seats','assigned_users','active_users','employees'].includes(row.denominator)||!Number.isSafeInteger(row.count)||row.count<0)throw Error('invalid population');
 if(row.denominator==='active_users'&&(!Number.isSafeInteger(row.activeWindowDays)||row.activeWindowDays<1||row.activeWindowDays>366))throw Error('active window required');
 return {accountId,scope:row.scope,sourceId:row.sourceId,sourceRecordId:row.sourceRecordId,month:row.month,recordedAt:row.recordedAt,denominator:row.denominator,count:row.count,activeWindowDays:row.denominator==='active_users'?row.activeWindowDays:null};
}
