export function sourceHealth(connection,now,maxAge){
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(maxAge)||maxAge<=0)throw Error('invalid_freshness_policy');
 if(!connection.enabled)return 'disabled';
 const last=connection.last_success_at;
 if(connection.sync_state==='failed')return 'failed';
 if(!Number.isSafeInteger(last)||last>now)return 'unknown';
 if(now-last>maxAge)return 'stale';
 return connection.sync_state==='running'?'syncing':'fresh';
}
