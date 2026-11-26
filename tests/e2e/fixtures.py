"""Prepare/revoke disposable US Preview fixtures through the authenticated Cloudflare API.
No email is sent. Login and invite tokens are redeemed through the normal app handlers.
Requires Python 3.11+; secrets are read in memory and never printed.
"""
import argparse, hashlib, json, os, pathlib, re, secrets, time, tomllib, urllib.request
p=argparse.ArgumentParser();p.add_argument('action',choices=['prepare','cleanup']);p.add_argument('--run',required=True);p.add_argument('--deployment',required=True);p.add_argument('--output',required=True);args=p.parse_args()
assert re.fullmatch(r'sst-us-e2e-[a-z0-9-]+',args.run)
assert re.fullmatch(r'[a-f0-9-]{36}',args.deployment)
assert os.environ.get('PREVIEW_DB_VERIFIED')=='sst-preview-us'
assert os.environ.get('PREVIEW_TEST_CONFIRM')=='disposable-synthetic-workspaces'
config=pathlib.Path(os.environ.get('WRANGLER_CONFIG',pathlib.Path.home()/'Library/Preferences/.wrangler/config/default.toml'))
auth=tomllib.loads(config.read_text())['oauth_token']
account='c4dd057c28c85861e01dea75d0adcfbe';db='1f35200e-11ae-498d-a7a7-a0909259084c'
def cf(path,data=None):
 req=urllib.request.Request('https://api.cloudflare.com/client/v4/accounts/'+account+path,data=None if data is None else json.dumps(data).encode(),headers={'Authorization':'Bearer '+auth,'Content-Type':'application/json'})
 j=json.load(urllib.request.urlopen(req,timeout=30));assert j['success'];return j['result']
def sql(q,params=()):return cf('/d1/database/'+db+'/query',{'sql':q,'params':list(params)})[0]['results']
d=cf('/pages/projects/saasspendtrack-preview-us/deployments/'+args.deployment)
assert d['environment']=='preview' and d['d1_databases']['DB']['id']==db and d['env_vars']['AI_GLOBAL_DISABLED']['value']=='true'
out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True,mode=0o700)
(out/'deployment.json').write_text(json.dumps({'url':d['url'],'source':d['deployment_trigger']['metadata'],'DB':db,'AI_GLOBAL_DISABLED':True},indent=2))
run=args.run;ids=[run+'-a',run+'-b'];emails=[run+'-'+s+'@example.invalid' for s in ['a','b','admin','member','invite']];t=int(time.time()*1000)
for suffix in ['a','b']:
 rows=sql('SELECT name,owner_email FROM accounts WHERE id=?',[run+'-'+suffix])
 if rows:assert rows[0]=={'name':'Synthetic US Release '+suffix.upper(),'owner_email':run+'-'+suffix+'@example.invalid'}
if args.action=='prepare':
 tokens={}
 for who in ['a','b','admin','member']:
  email=run+'-'+who+'@example.invalid';aid=run+'-'+('b' if who=='b' else 'a')
  sql('INSERT OR IGNORE INTO users(email,created_at,trial_ends_at,status) VALUES (?,?,?,?)',[email,t,t+86400000,'trial'])
  if who in ['a','b']:sql('INSERT OR IGNORE INTO accounts(id,name,owner_email,created_at) VALUES (?,?,?,?)',[aid,'Synthetic US Release '+who.upper(),email,t])
  sql('INSERT OR IGNORE INTO memberships(email,account_id,role,status,created_at) VALUES (?,?,?,?,?)',[email,aid,who if who in ['admin','member'] else 'owner','active',t])
  assert sql('SELECT account_id FROM memberships WHERE email=?',[email])[0]['account_id']==aid
  sql('INSERT OR IGNORE INTO email_log(email,kind,sent_at) VALUES (?,?,?)',[email,'welcome',t])
  token=secrets.token_hex(32);tokens[who]=token
  sql('INSERT INTO login_tokens(token_hash,email,expires_at) VALUES (?,?,?)',[hashlib.sha256(token.encode()).hexdigest(),email,t+3600000])
 # Baseline is fixture setup, not a UI-create test.
 baseline={'subscriptions':[{'id':'synthetic-cedar','name':'Synthetic Cedar A','cost':1440,'cycle':'yearly','active':True,'renewal':'2026-12-26'}],'settings':{'currency':'USD'}}
 sql('INSERT OR IGNORE INTO app_data(email,data,updated_at,version) VALUES (?,?,?,1)',[emails[0],json.dumps(baseline),t])
 token=secrets.token_hex(32);tokens['invite']=token
 sql('INSERT INTO invites(token_hash,account_id,email,role,invited_by,expires_at,created_at) VALUES (?,?,?,?,?,?,?)',[hashlib.sha256(token.encode()).hexdigest(),ids[0],emails[-1],'member',emails[0],t+3600000,t])
 pending=not sql('SELECT 1 FROM app_data WHERE email=?',[emails[1]])
 manifest=out/'fixtures.json';manifest.write_text(json.dumps({'run':run,'tokens':tokens,'legacyImportPending':pending}));manifest.chmod(0o600)
 print('Synthetic fixtures verified/prepared. Private token manifest written; no email sent.')
else:
 counts={}
 scopes=[(table,'account_id',ids) for table in ['usage_events','ai_egress_audit','workspace_ai_consent_events','workspace_ai_lock_events','workspace_ai_settings','workspace_ai_locks','invites','memberships']]+[(table,'email',emails) for table in ['sessions','login_tokens','email_log','app_data','users']]+[('accounts','id',ids)]
 for table,column,values in scopes:
  placeholders=','.join('?' for _ in values);where=column+' IN ('+placeholders+')'
  counts[table]=sql('SELECT COUNT(*) AS n FROM '+table+' WHERE '+where,values)[0]['n']
  sql('DELETE FROM '+table+' WHERE '+where,values)
  assert sql('SELECT COUNT(*) AS n FROM '+table+' WHERE '+where,values)[0]['n']==0
 (out/'cleanup.json').write_text(json.dumps({'run':run,'database':'sst-preview-us','deletedCounts':counts,'remainingScopedRows':0},indent=2))
 (out/'fixtures.json').unlink(missing_ok=True)
 print('Exact synthetic rows removed; all scoped counts verified zero.')
