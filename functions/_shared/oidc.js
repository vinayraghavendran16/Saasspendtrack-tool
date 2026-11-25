// Only fixed provider key endpoints are trusted; never follow token-supplied URLs.
function decode(s) {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('invalid_token');
  return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')), c=>c.charCodeAt(0));
}
function object(s) { return JSON.parse(new TextDecoder().decode(decode(s))); }
export async function validateIdToken(token, provider, clientId, nonce, fetcher=fetch, clock=Date.now) {
  if (typeof token !== 'string' || token.length > 32768 || !clientId || !nonce) throw new Error('invalid_token');
  const parts=token.split('.');
  if(parts.length!==3) throw new Error('invalid_token');
  const [h,p,s]=parts, header=object(h), claims=object(p);
  if(header.alg!=='RS256' || typeof header.kid!=='string' || !header.kid || header.crit) throw new Error('invalid_header');
  let keysUrl, issuer;
  if(provider==='google') {
    keysUrl='https://www.googleapis.com/oauth2/v3/certs';
    if(!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)) throw new Error('invalid_issuer');
    issuer='https://accounts.google.com';
  } else if(provider==='microsoft') {
    if(typeof claims.tid!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.tid)) throw new Error('invalid_tenant');
    issuer='https://login.microsoftonline.com/'+claims.tid+'/v2.0';
    if(claims.iss!==issuer || claims.ver!=='2.0') throw new Error('invalid_issuer');
    keysUrl='https://login.microsoftonline.com/'+claims.tid+'/discovery/v2.0/keys';
  } else throw new Error('invalid_provider');
  const audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(!audiences.includes(clientId) || (audiences.length!==1 && claims.azp!==clientId) || (claims.azp!==undefined && claims.azp!==clientId)) throw new Error('invalid_audience');
  const t=Math.floor(clock()/1000);
  if(!Number.isSafeInteger(claims.exp)||claims.exp<=t||!Number.isSafeInteger(claims.iat)||claims.iat>t+60||claims.iat<t-900||(claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>t+60))) throw new Error('invalid_time');
  if(claims.nonce!==nonce || typeof claims.sub!=='string'||!claims.sub||claims.sub.length>255) throw new Error('invalid_identity');
  const response=await fetcher(keysUrl,{redirect:'error',headers:{accept:'application/json'}});
  if(!response.ok) throw new Error('keys_unavailable');
  const jwks=await response.json();
  const matches=(jwks.keys||[]).filter(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.use||k.use==='sig')&&(!k.alg||k.alg==='RS256')&&(!k.issuer||k.issuer.replace('{tenantid}',claims.tid)===issuer));
  if(matches.length!==1) throw new Error('invalid_key');
  const key=await crypto.subtle.importKey('jwk',matches[0],{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(s),new TextEncoder().encode(h+'.'+p))) throw new Error('invalid_signature');
  // Email is a display/contact hint, never an authorization key for account linking.
  return {provider,issuer,subject:claims.sub,email:typeof claims.email==='string'?claims.email:null,emailVerified:provider==='google'&&claims.email_verified===true};
}
