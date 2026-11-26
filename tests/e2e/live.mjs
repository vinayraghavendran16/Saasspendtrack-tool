import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {parseUsPreviewUrl} from '../../scripts/preview-api-target.mjs';
const origin=parseUsPreviewUrl(process.env.PREVIEW_URL).origin;
assert.equal(process.env.PREVIEW_DB_VERIFIED,'sst-preview-us');
assert.equal(process.env.PREVIEW_TEST_CONFIRM,'disposable-synthetic-workspaces');
const manifest=JSON.parse(await fs.readFile(process.env.E2E_FIXTURE_FILE,'utf8'));
const {run,tokens}=manifest;
assert.match(run,/^sst-us-e2e-[a-z0-9-]+$/);
const deployment=JSON.parse(await fs.readFile(process.env.E2E_DEPLOYMENT_FILE,'utf8'));
assert.equal(deployment.url.replace(/\/$/,''),origin);
assert.equal(deployment.DB,'1f35200e-11ae-498d-a7a7-a0909259084c');
assert.equal(deployment.AI_GLOBAL_DISABLED,true);
const testedCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const root=process.env.E2E_OUTPUT||'test-results/live';await fs.mkdir(root,{recursive:true});
assert.ok(process.env.E2E_PROFILE,'Dedicated test-only profile is required; never use an existing Chrome profile');
const results=[],network=[];
const ctx=await chromium.launchPersistentContext(process.env.E2E_PROFILE,{...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),headless:false,chromiumSandbox:true,ignoreHTTPSErrors:false,viewport:{width:1440,height:1000}});
const browser=ctx.browser();
const auth=await ctx.storageState();
const access={cookies:auth.cookies.filter(c=>c.name==='CF_Authorization'),origins:[]};
await ctx.clearCookies({name:'sst_session'});
const contexts={a:ctx};
for(const who of ['b','admin','member','invite'])contexts[who]=await browser.newContext({storageState:access,viewport:{width:1440,height:1000},ignoreHTTPSErrors:false});
async function setup(c){
 await c.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===origin||u.protocol==='https:'&&(u.hostname.endsWith('.cloudflareaccess.com')||['challenges.cloudflare.com','fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net','cdnjs.cloudflare.com'].includes(u.hostname))?r.continue():r.abort();});
 c.on('response',r=>{const u=new URL(r.url());if(u.origin===origin)network.push({path:u.pathname,method:r.request().method(),status:r.status()});});
}
for(const c of Object.values(contexts)){c.setDefaultTimeout(12000);c.setDefaultNavigationTimeout(30000);await setup(c);}
async function persist(){await fs.writeFile(root+'/results.json',JSON.stringify({releaseCommit:testedCommit,deployedCommit:deployment.source.commit_hash,origin,results,network},null,2));}
async function test(name,fn){try{await fn();results.push({name,status:'passed'});console.log('PASS',name)}catch(e){results.push({name,status:'failed',error:String(e.message).replace(/[a-f0-9]{64}/g,'[redacted]').slice(0,1500)});console.log('FAIL',name,e.name)}await persist();}
async function api(who,path,method='GET',data,version){
 assert.ok(!['/api/ai/consent','/api/ai/lock'].includes(path)||method==='GET','AI settings must remain untouched');
 assert.ok(path.startsWith('/api/')&&!path.includes('://'));
 const r=await contexts[who].request.fetch(origin+path,{method,data,headers:version===undefined?{}:{'If-Match':String(version)},maxRedirects:0});
 network.push({actor:who,path:path.split('?')[0],method,status:r.status()});
 let body;try{body=await r.json()}catch{body=null}
 return {status:r.status(),body,headers:r.headers()};
}
const pages={};
for(const who of ['a','b','admin','member']){
 await test(who+' synthetic authentication',async()=>{const r=await api(who,'/api/auth/verify?token='+tokens[who]);assert.equal(r.status,302);assert.ok(r.headers.location.endsWith('?auth=ok'));const me=await api(who,'/api/me');assert.equal(me.body.email,run+'-'+who+'@example.invalid');assert.equal(me.body.account.id,run+'-'+(who==='b'?'b':'a'));});
 pages[who]=await contexts[who].newPage();
}
assert.ok(results.every(r=>r.status==='passed'),'Fixture authentication failed; refusing mutations');
for(const who of ['a','b']){const snapshot=(await api(who,'/api/data')).body;assert.equal(snapshot.workspaceId,run+'-'+who);assert.ok((snapshot.data?.subscriptions||[]).every(s=>s.name.startsWith('Synthetic ')),'Refusing non-synthetic records');}
if (process.env.SST_TEST_WORKSPACE_FREEZE === '1') {
 await test('workspace save is blocked during freeze and revision checks resume', async()=>{
  const trigger='recovery_e2e_'+run.replaceAll('-','_');
  const ownerEmail=run+'-a@example.invalid';
  const d1=sql=>execFileSync('npx',['wrangler','d1','execute','sst-preview-us','--remote','--command',sql],{stdio:'pipe',timeout:60000});
  const before=await api('a','/api/data');
  assert.equal(before.status,200);
  const candidate={...before.body.data,settings:{...before.body.data.settings,recoveryProbe:true}};
  try {
   d1(`CREATE TRIGGER ${trigger} BEFORE UPDATE ON app_data
       WHEN OLD.email = '${ownerEmail}'
       BEGIN SELECT RAISE(ABORT, 'workspace_writes_frozen'); END;`);
   const frozen=await api('a','/api/data','PUT',candidate,before.body.version);
   assert.equal(frozen.status,500,'Expected the deployed save to fail during the freeze');
   const still=await api('a','/api/data');
   assert.equal(still.status,200);
   assert.equal(still.body.version,before.body.version);
   assert.deepEqual(still.body.data,before.body.data);
  } finally {
   d1(`DROP TRIGGER IF EXISTS ${trigger};`);
  }
  const saved=await api('a','/api/data','PUT',candidate,before.body.version);
  assert.equal(saved.status,200);
  assert.equal(saved.body.version,before.body.version+1);
  assert.equal((await api('a','/api/data','PUT',before.body.data,before.body.version)).status,409);
  const after=await api('a','/api/data');
  assert.equal(after.status,200);
  assert.equal(after.body.version,saved.body.version);
  assert.equal(after.body.data.settings.recoveryProbe,true);
 });
}
await test('login token replay rejected',async()=>{const r=await api('b','/api/auth/verify?token='+tokens.a);assert.equal(r.status,302);assert.ok(r.headers.location.endsWith('?auth=expired'));});
await test('workspace identity and isolation',async()=>{const a=await api('a','/api/data'),b=await api('b','/api/data');assert.equal(a.body.workspaceId,run+'-a');assert.equal(b.body.workspaceId,run+'-b');assert.ok(a.body.data.subscriptions.some(s=>s.name==='Synthetic Cedar A'));assert.ok(!(b.body.data?.subscriptions||[]).some(s=>s.name==='Synthetic Cedar A'));});
await test('missing precondition and concurrent writes',async()=>{let a=await api('a','/api/data');assert.equal((await api('a','/api/data','PUT',a.body.data)).status,428);const data=a.body.data;const race=await Promise.all(['one','two'].map(writer=>api('a','/api/data','PUT',{...data,settings:{...data.settings,e2eWriter:writer}},a.body.version)));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);const after=await api('a','/api/data');assert.equal(after.body.version,a.body.version+1);assert.equal(after.body.data.settings.e2eWriter,['one','two'][race.findIndex(r=>r.status===200)]);assert.ok(!((await api('b','/api/data')).body.data?.subscriptions||[]).some(s=>s.name==='Synthetic Cedar A'));});
await test('owner/admin/member privacy permissions and AI disabled',async()=>{for(const who of ['a','admin','member']){const c=await api(who,'/api/ai/consent');assert.equal(c.status,200);assert.equal(c.body.enabled,false);assert.equal(c.body.canEnable,false);for(const p of ['/api/ai/audit','/api/ai/evidence'])assert.equal((await api(who,p)).status,who==='member'?403:200);}});
await test('role escalation and cross-workspace management denied',async()=>{assert.equal((await api('member','/api/account/member-role','POST',{email:run+'-admin@example.invalid',role:'member'})).status,403);assert.equal((await api('admin','/api/account/member-role','POST',{email:run+'-member@example.invalid',role:'admin'})).status,403);assert.equal((await api('a','/api/account/member-role','POST',{email:run+'-b@example.invalid',role:'admin'})).status,404);assert.equal((await api('a','/api/account/member-role','POST',{email:run+'-member@example.invalid',role:'admin'})).status,200);assert.equal((await api('a','/api/account/member-role','POST',{email:run+'-member@example.invalid',role:'member'})).status,200);});
await test('invite acceptance and replay rejection',async()=>{let r=await api('invite','/api/account/accept?token='+tokens.invite);assert.equal(r.status,302);assert.ok(r.headers.location.endsWith('?invite=ok'));assert.equal((await api('invite','/api/me')).body.account.id,run+'-a');r=await api('b','/api/account/accept?token='+tokens.invite);assert.ok(r.headers.location.endsWith('?invite=expired'));assert.equal((await api('b','/api/me')).body.account.id,run+'-b');});
await test('audit validation and privacy evidence',async()=>{assert.equal((await api('a','/api/ai/audit?days=1')).status,400);assert.equal((await api('a','/api/ai/audit?cursor=bad')).status,400);const e=await api('a','/api/ai/evidence');assert.equal(e.body.policy.enabled,false);assert.match(e.headers['cache-control'],/no-store/);await fs.writeFile(root+'/privacy-evidence.json',JSON.stringify(e.body,null,2));});
const page=pages.a;
await test('UI persisted subscription hydration',async()=>{await page.goto(origin+'/#subscriptions');await page.locator('#subscriptions').getByText('Synthetic Cedar A',{exact:true}).filter({visible:true}).waitFor({state:'visible'});await page.screenshot({path:root+'/subscriptions-desktop.png'});});
await test('pointer subscription create',async()=>{await page.getByRole('button',{name:/Add subscription/}).click();await page.locator('#f-name').fill('Synthetic Pointer E2E');await page.locator('#f-cost').fill('25');await page.locator('#f-cycle').selectOption('monthly');await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/data'&&r.request().method()==='PUT'&&r.status()===200,{timeout:10000}),page.locator('#sub-form').getByRole('button',{name:'Save',exact:true}).click()]);await page.locator('#f-name').waitFor({state:'hidden',timeout:5000});assert.ok((await api('a','/api/data')).body.data.subscriptions.some(s=>s.name==='Synthetic Pointer E2E'));});
await test('privacy download pointer',async()=>{await page.goto(origin+'/#integrations');await page.reload();await page.locator('#workspace-ai-state').filter({hasText:'AI disabled.'}).waitFor();assert.equal(await page.locator('#workspace-ai-optin').isDisabled(),true);const [d]=await Promise.all([page.waitForEvent('download',{timeout:15000}),page.getByRole('link',{name:'Download AI privacy evidence',exact:true}).click()]);await d.saveAs(root+'/privacy-download.json');assert.equal(JSON.parse(await fs.readFile(root+'/privacy-download.json','utf8')).policy.enabled,false);});
await test('workspace JSON download pointer',async()=>{await page.goto(origin+'/#subscriptions');await page.reload();
 const vendor='Synthetic Cedar A';
 await page.locator('#sub-tbody').getByText(vendor,{exact:true}).waitFor();
 const [download]=await Promise.all([
  page.waitForEvent('download',{timeout:15000}),
  page.locator('#export-btn').click()
 ]);
 await download.saveAs(root+'/workspace-export.json');
 const data=JSON.parse(await fs.readFile(root+'/workspace-export.json','utf8'));
 assert.ok(data.subscriptions?.some(subscription=>subscription.name===vendor),'Export must contain the hydrated synthetic subscription');});
await test('UI subscription update and deletion by pointer',async()=>{
 await page.goto(origin+'/#subscriptions');const row=page.locator('#subscriptions tr').filter({hasText:'Synthetic Pointer E2E'});await row.getByRole('button',{name:'Edit',exact:true}).click();await page.locator('#f-cost').fill('30');await page.locator('#f-renewal').fill('2026-12-26');await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/data'&&r.request().method()==='PUT'&&r.status()===200),page.locator('#sub-form').getByRole('button',{name:'Save',exact:true}).click()]);assert.equal((await api('a','/api/data')).body.data.subscriptions.find(s=>s.name==='Synthetic Pointer E2E').cost,30);
 page.once('dialog',d=>d.accept());await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/data'&&r.request().method()==='PUT'&&r.status()===200),row.getByRole('button',{name:'Delete',exact:true}).click()]);assert.ok(!(await api('a','/api/data')).body.data.subscriptions.some(s=>s.name==='Synthetic Pointer E2E'));
});
if(manifest.legacyImportPending){
await test('legacy browser import preserves EUR and original cache',async()=>{
 const p=pages.b;const legacy={subscriptions:[{id:'synthetic-eur',name:'Synthetic EUR Legacy',cost:99.5,cycle:'monthly',active:true,renewal:'2026-12-26'}],invoices:[],employees:[],settings:{currency:'EUR'}};
 await p.addInitScript(data=>{if(!localStorage.getItem('saasspendtrack.v1'))localStorage.setItem('saasspendtrack.v1',JSON.stringify(data))},legacy);
 await p.goto(origin+'/#subscriptions');await p.getByRole('button',{name:'Review legacy import',exact:true}).waitFor();assert.equal((await api('b','/api/data')).body.empty,true);
 const dialogs=[];const handler=async d=>{dialogs.push(d.type());await d.accept(d.type()==='prompt'?'EUR':undefined)};p.on('dialog',handler);
 await Promise.all([p.waitForResponse(r=>r.url()===origin+'/api/data'&&r.request().method()==='PUT'&&r.status()===200),p.getByRole('button',{name:'Review legacy import',exact:true}).click()]);p.off('dialog',handler);assert.deepEqual(dialogs,['prompt','confirm']);let b=(await api('b','/api/data')).body;assert.equal(b.data.settings.currency,'EUR');assert.equal(b.data.subscriptions[0].cost,99.5);assert.equal(b.data.subscriptions[0].currency,'EUR');assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('saasspendtrack.v1'))),legacy);await p.reload();await p.locator('#subscriptions').getByText('Synthetic EUR Legacy',{exact:true}).filter({visible:true}).waitFor();await p.screenshot({path:root+'/legacy-eur-import.png'});
 const bad={...b.data,settings:{...b.data.settings,currency:'USD'},subscriptions:b.data.subscriptions.map(s=>({...s,currency:'USD'}))};assert.equal((await api('b','/api/data','PUT',bad,b.version)).status,422);assert.equal((await api('a','/api/data')).body.data.subscriptions.some(s=>s.name==='Synthetic EUR Legacy'),false);
});
}
await test('AI endpoints deny processing without setting changes',async()=>{for(const endpoint of ['/api/ask','/api/extract','/api/preset/generate','/api/renewal-guide']){const r=await api('a',endpoint,'POST',{question:'Synthetic test only',text:'Synthetic contract',snapshot:{}});assert.equal(r.status,403,endpoint);}assert.equal((await api('a','/api/ai/consent')).body.enabled,false);});
await test('member and admin data writes preserve shared workspace',async()=>{for(const who of ['member','admin']){const a=(await api(who,'/api/data')).body;assert.equal(a.workspaceId,run+'-a');const next={...a.data,settings:{...a.data.settings,e2eRole:who}};assert.equal((await api(who,'/api/data','PUT',next,a.version)).status,200);}assert.equal((await api('a','/api/data')).body.data.settings.e2eRole,'admin');});
await test('workspace usage privacy permissions',async()=>{assert.equal((await api('member','/api/account/usage')).status,403);const u=await api('a','/api/account/usage');assert.equal(u.status,200);assert.equal(u.body.scope,'workspace');assert.ok(u.body.totals.events>0);await fs.writeFile(root+'/usage-aggregate.json',JSON.stringify(u.body,null,2));});
await test('responsive layouts and automated accessibility',async()=>{
 const {default:AxeBuilder}=await import('@axe-core/playwright');const scans=[];
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});await page.goto(origin+'/#subscriptions');await page.locator('#subscriptions').getByText('Synthetic Cedar A',{exact:true}).filter({visible:true}).waitFor();await page.screenshot({path:root+`/subscriptions-${width}.png`,fullPage:true});const overflow=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));await page.waitForTimeout(500);const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();scans.push({width,overflow,violations:a.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,failureSummary:n.failureSummary}))}))});}
 await fs.writeFile(root+'/accessibility.json',JSON.stringify(scans,null,2));assert.equal(scans.flatMap(s=>s.violations).length,0,'Automated accessibility violations recorded');assert.ok(scans.every(s=>s.overflow.document<=s.overflow.viewport),'Page overflow');
});
await test('fresh browser context persistence and isolation',async()=>{const saved=await contexts.b.storageState();const fresh=await browser.newContext({storageState:saved});await setup(fresh);const p=await fresh.newPage();await p.goto(origin+'/#subscriptions');await p.locator('#subscriptions').getByText('Synthetic EUR Legacy',{exact:true}).filter({visible:true}).waitFor();assert.equal(await p.locator('#subscriptions').getByText('Synthetic Cedar A',{exact:true}).count(),0);await fresh.close();});
await test('logout invalidates captured test session',async()=>{const before=await contexts.member.storageState();const replay=await browser.newContext({storageState:before});assert.equal((await api('member','/api/auth/logout','POST')).status,200);assert.equal((await api('member','/api/data')).status,401);const r=await replay.request.get(origin+'/api/data',{maxRedirects:0});assert.equal(r.status(),401);network.push({path:'/api/data',actor:'logged-out-session-replay',method:'GET',status:r.status()});await replay.close();});

await persist();
await page.screenshot({path:root+'/checkpoint.png'});
await fs.writeFile(root+'/ui-checkpoint.txt',await page.locator('body').innerText());
console.log('BATCH COMPLETE',results.filter(r=>r.status==='passed').length,'passed',results.filter(r=>r.status==='failed').length,'failed');
await ctx.close();await browser.close();process.exitCode=results.some(r=>r.status==='failed')?1:0;
