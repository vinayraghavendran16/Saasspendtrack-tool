// Local browser regressions. All API responses are synthetic stubs; never live Preview evidence.
import {chromium,firefox,webkit} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import http from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';import AxeBuilder from '@axe-core/playwright';
const repo=fileURLToPath(new URL('../../',import.meta.url)),out=process.env.E2E_OUTPUT||path.join(repo,'test-results/local');await fs.mkdir(out,{recursive:true});
const server=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname;if(name==='/api/ai/evidence'){
  res.setHeader('Content-Type','application/json');
  res.setHeader('Content-Disposition','attachment; filename="sst-ai-privacy-evidence.json"');
  res.end(JSON.stringify({policy:{enabled:false}}));
  return;
}if(!['/','/auth-gate.js','/sw.js','/app.js','/manifest.json'].includes(name)){res.statusCode=404;res.end();return;}const f=path.join(repo,name==='/'?'index.html':name);const data=await fs.readFile(f);res.setHeader('content-type',f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream');res.end(data)}catch{res.statusCode=404;res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const engine=process.env.E2E_BROWSER||'chromium';const engines={chromium,firefox,webkit};assert.ok(Object.hasOwn(engines,engine),'Unsupported browser engine');const browser=await engines[engine].launch({...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),headless:true,...(engine==='chromium'?{chromiumSandbox:true}:{})});const ctx=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});ctx.setDefaultTimeout(10000);
let data={subscriptions:[{id:'local-cedar',name:'Synthetic Cedar Local',cost:1440,cycle:'yearly',renewal:'2026-12-26',active:true}],invoices:[],settings:{currency:'USD'}},version=1;const results=[];let authFixture="trial";
// Keep the attachment request outside Playwright routing so the browser handles it natively.
await ctx.route(url=>url.href!==origin+'/api/ai/evidence',async route=>{const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();let body={},status=200;switch(u.pathname){case '/api/me':body=authFixture==='anonymous'?{authenticated:false}:{authenticated:true,entitled:true,status:authFixture==='owner'?'active':'trial',plan:authFixture==='owner'?'platform_owner':null,platformOwner:authFixture==='owner',email:'local@example.invalid',daysLeft:1,trialEndsAt:Date.now()+86400000,account:{id:'local-test',role:'owner',name:'Local Synthetic',isOwner:true}};break;case '/api/auth/oauth/providers':body={providers:['google','microsoft']};break;case '/api/data':if(route.request().method()==='PUT'){assert.equal(route.request().headers()['if-match'],String(version));data=route.request().postDataJSON();version++;}body={data,version,workspaceId:'local-test'};break;case '/api/ai/consent':body={enabled:false,canEnable:false,canManage:true,canLock:true};break;case '/api/ai/audit':body={records:[]};break;case '/api/account/members':body={members:[],invites:[],role:'owner',canManage:true};break;default:body={};}await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});});
const p=await ctx.newPage();async function test(name,fn){try{await fn();results.push({name,status:'passed'});console.log('PASS',name)}catch(e){results.push({name,status:'failed',error:e.message});console.error('FAIL',name,e.message)}await fs.writeFile(out+'/results.json',JSON.stringify(results,null,2))}
await p.goto(origin+'/#subscriptions');await p.locator('#subscriptions').getByText('Synthetic Cedar Local',{exact:true}).filter({visible:true}).waitFor();
await test('pointer save unobstructed by onboarding widget',async()=>{await p.getByRole('button',{name:/Add subscription/}).click();await p.locator('#f-name:focus').waitFor();await p.locator('#f-name').fill('Pointer Regression');await p.locator('#f-cost').fill('25');await Promise.all([p.waitForResponse(r=>r.url()===origin+'/api/data'&&r.request().method()==='PUT'),p.locator('#sub-form').getByRole('button',{name:'Save',exact:true}).click()]);await p.locator('#modal').waitFor({state:'hidden'});assert.ok(data.subscriptions.some(s=>s.name==='Pointer Regression'));await p.screenshot({path:out+'/pointer-save.png'});});
await test('subscription search and empty results',async()=>{await p.goto(origin+'/#subscriptions');const search=p.locator('#search');await search.fill('Pointer Regression');await p.locator('#sub-tbody').getByText('Pointer Regression',{exact:true}).waitFor();assert.equal(await p.locator('#sub-tbody').getByText('Synthetic Cedar Local',{exact:true}).count(),0);await search.fill('no-such-synthetic-subscription');assert.equal(await p.locator('#sub-tbody').getByText('Pointer Regression',{exact:true}).count(),0);await search.fill('');await p.locator('#sub-tbody').getByText('Synthetic Cedar Local',{exact:true}).waitFor();});
await test('negative subscription cost rejected without persistence',async()=>{await p.getByRole('button',{name:/Add subscription/}).click();await p.locator('#f-name:focus').waitFor();await p.locator('#f-name').fill('Invalid Negative Cost');await p.locator('#f-cost').fill('-1');const previous=version;assert.equal(await p.locator('#f-cost').evaluate(el=>el.validity.rangeUnderflow),true);await p.locator('#sub-form').getByRole('button',{name:'Save',exact:true}).click();assert.equal(version,previous);assert.ok(!data.subscriptions.some(s=>s.name==='Invalid Negative Cost'));await p.reload();await p.locator('#sub-tbody').getByText('Synthetic Cedar Local',{exact:true}).waitFor();await p.locator('#modal').waitFor({state:'hidden'});});
await test('billing cycle normalization and seat utilization',async()=>{const values=await p.evaluate(()=>({monthly:monthlyCost({cost:100,cycle:'monthly'}),yearly:monthlyCost({cost:1200,cycle:'yearly'}),quarterly:monthlyCost({cost:300,cycle:'quarterly'}),invalid:monthlyCost({cost:100,cycle:'invalid'}),seats:consumption({cost:1200,cycle:'yearly',licenses:10,assigned:8,utilized:6}),paused:consumption({cost:1200,cycle:'yearly',licenses:10,assigned:8,utilized:6,active:false})}));assert.equal(values.monthly,100);assert.equal(values.yearly,100);assert.equal(values.quarterly,100);assert.equal(values.invalid,0);assert.equal(values.seats.unused,4);assert.equal(values.seats.utilizationPct,60);assert.equal(values.seats.unusedCostMonthly,40);assert.equal(values.paused.unusedCostMonthly,0);});
await test('renewal calendar edge cases',async()=>{const values=await p.evaluate(()=>{const add=(date,cycle,n)=>localDateISO(addCycles(parseDate(date),cycle,n));const today=new Date();today.setHours(0,0,0,0);const future=new Date(today);future.setDate(future.getDate()+10);const past=new Date(today);past.setDate(past.getDate()-8);const projected=nextRenewal({renewal:localDateISO(past),cycle:'weekly'});return {leap:add('2024-01-31','monthly',1),nonLeap:add('2025-01-31','monthly',1),anchor:add('2024-01-31','monthly',2),annual:add('2024-02-29','yearly',1),quarter:add('2025-01-31','quarterly',1),weekly:add('2025-12-29','weekly',1),missing:nextRenewalISO({}),future:nextRenewalISO({renewal:localDateISO(future),cycle:'monthly'}),expectedFuture:localDateISO(future),projectedValid:projected>=today&&projected<future};});assert.equal(values.leap,'2024-02-29');assert.equal(values.nonLeap,'2025-02-28');assert.equal(values.anchor,'2024-03-31');assert.equal(values.annual,'2025-02-28');assert.equal(values.quarter,'2025-04-30');assert.equal(values.weekly,'2026-01-05');assert.equal(values.missing,null);assert.equal(values.future,values.expectedFuture);assert.equal(values.projectedValid,true);});
await test('subscription edit persists after reload',async()=>{await p.goto(origin+'/#subscriptions');const row=p.locator('#sub-tbody tr').filter({hasText:'Pointer Regression'});await row.getByRole('button',{name:'Edit',exact:true}).click();await p.locator('#f-name:focus').waitFor();await p.locator('#f-cost').fill('37.50');const previous=version;await Promise.all([p.waitForResponse(r=>r.url()===origin+'/api/data'&&r.request().method()==='PUT'),p.locator('#sub-form').getByRole('button',{name:'Save',exact:true}).click()]);await p.locator('#modal').waitFor({state:'hidden'});assert.equal(version,previous+1);assert.equal(data.subscriptions.find(s=>s.name==='Pointer Regression').cost,37.5);await p.reload();await p.locator('#sub-tbody tr').filter({hasText:'Pointer Regression'}).getByText('$37.50',{exact:true}).first().waitFor();});
await test('cancellation notice calendar',async()=>{const result=await p.evaluate(()=>{const today=new Date();today.setHours(0,0,0,0);const future=new Date(today);future.setDate(future.getDate()+60);const s={renewal:localDateISO(future),cycle:'yearly',contract:{noticeDays:30}};const w=computeNoticeWindow(s);return {left:w.daysLeft,toRenewal:w.daysToRenewal,missing:computeNoticeWindow({...s,contract:{}})};});assert.equal(result.left,30);assert.equal(result.toRenewal,60);assert.equal(result.missing,null);});
await test('privacy evidence download',async()=>{await p.goto(origin+'/#integrations');await p.locator('#workspace-ai-state').filter({hasText:'AI disabled.'}).waitFor();const[d]=await Promise.all([p.waitForEvent('download'),p.getByRole('link',{name:'Download AI privacy evidence'}).click()]);assert.equal(d.suggestedFilename(),'sst-ai-privacy-evidence.json');await d.saveAs(out+'/privacy.json');assert.equal(JSON.parse(await fs.readFile(out+'/privacy.json')).policy.enabled,false);});
await test('workspace JSON export',async()=>{await p.goto(origin+'/#subscriptions');const[d]=await Promise.all([p.waitForEvent('download'),p.locator('#export-btn').click()]);await d.saveAs(out+'/workspace.json');assert.ok(JSON.parse(await fs.readFile(out+'/workspace.json')).subscriptions.some(s=>s.name==='Pointer Regression'));});
await test('subscription CSV export',async()=>{const[d]=await Promise.all([p.waitForEvent('download'),p.locator('#csv-subs-btn').click()]);await d.saveAs(out+'/renewals.csv');assert.match(await fs.readFile(out+'/renewals.csv','utf8'),/Synthetic Cedar Local/);});
await test('responsive accessibility scan',async()=>{const scans=[];for(const width of [1440,768,390]){await p.setViewportSize({width,height:900});await p.goto(origin+'/#subscriptions');await p.locator('#sub-tbody').getByText('Synthetic Cedar Local',{exact:true}).waitFor({state:'attached'});await p.locator('#subscriptions').evaluate(async section=>{await document.fonts.ready;await Promise.all(section.getAnimations().map(animation=>animation.finished));});const a=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();const overflow=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));scans.push({width,overflow,violations:a.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});await p.screenshot({path:out+`/responsive-${width}.png`,fullPage:true});}await fs.writeFile(out+'/accessibility.json',JSON.stringify(scans,null,2));for(const {width,violations} of scans)assert.deepEqual(violations,[],`Accessibility violations at ${width}px: ${JSON.stringify(violations)}`);assert.ok(scans.every(s=>s.overflow.scroll<=s.overflow.width),'No document overflow');});
await p.setViewportSize({width:1440,height:1000});
const workspaceWrite=r=>r.url()===origin+'/api/data'&&r.request().method()==='PUT';

await test('invoice creation, edit and payment persist after reload',async()=>{
  await p.goto(origin+'/#invoices');
  const vendor=data.subscriptions.find(s=>s.name==='Pointer Regression');
  assert.ok(vendor);
  const invoiceNumber='SYNTHETIC-LOCAL-042';
  const row=p.locator('#inv-tbody tr').filter({hasText:invoiceNumber});
  const modal=p.locator('#inv-modal');
  const save=modal.getByRole('button',{name:'Save',exact:true});

  await p.locator('#add-inv-btn').click();
  await modal.locator('#inv-sub').selectOption(vendor.id);
  await modal.locator('#inv-number').fill(invoiceNumber);
  await modal.locator('#inv-amount').fill('125');
  const dueDate=new Date();
  dueDate.setDate(dueDate.getDate()+30);
  await modal.locator('#inv-due').fill(dueDate.toISOString().slice(0,10));
  await Promise.all([p.waitForResponse(workspaceWrite),save.click()]);
  await row.getByText('Pending',{exact:true}).waitFor();
  const created=data.invoices.find(i=>i.invoiceNumber===invoiceNumber);
  assert.equal(created.subId,vendor.id);
  assert.equal(created.amount,125);

  await row.getByRole('button',{name:'Edit',exact:true}).click();
  await modal.locator('#inv-amount').fill('175.50');
  await Promise.all([p.waitForResponse(workspaceWrite),save.click()]);
  assert.equal(data.invoices.find(i=>i.id===created.id).amount,175.5);
  assert.equal(data.invoices.filter(i=>i.invoiceNumber===invoiceNumber).length,1);

  await Promise.all([p.waitForResponse(workspaceWrite),row.getByRole('button',{name:'Mark paid'}).click()]);
  assert.match(data.invoices.find(i=>i.id===created.id).paidDate,/^\d{4}-\d{2}-\d{2}$/);
  await p.reload();
  await p.locator('#inv-filter-status').selectOption('paid');
  await row.getByText(/^Paid /).waitFor();
  await row.getByText('$175.50',{exact:true}).waitFor();
  await p.locator('#inv-filter-status').selectOption('pending');
  await row.waitFor({state:'detached'});
});

await test('subscription deletion confirms the invoice cascade and persists',async()=>{
  await p.goto(origin+'/#subscriptions');
  const vendor=data.subscriptions.find(s=>s.name==='Pointer Regression');
  assert.ok(vendor);
  const row=p.locator('#sub-tbody tr').filter({hasText:vendor.name});
  const remove=row.getByRole('button',{name:'Delete',exact:true});
  const previous=version;
  const invoiceCount=data.invoices.filter(i=>i.subId===vendor.id).length;
  assert.equal(invoiceCount,1);
  const confirmation='Delete "'+vendor.name+'" and 1 invoice(s)?';

  const [cancelled]=await Promise.all([
    p.waitForEvent('dialog').then(async dialog=>{
      const message=dialog.message();
      await dialog.dismiss();
      return message;
    }),
    remove.click()
  ]);
  assert.equal(cancelled,confirmation);
  assert.equal(version,previous);
  assert.equal(data.invoices.filter(i=>i.subId===vendor.id).length,1);

  const preservedSubscriptions=data.subscriptions.filter(s=>s.id!==vendor.id);
  const preservedInvoices=data.invoices.filter(i=>i.subId!==vendor.id);
  const [message]=await Promise.all([
    p.waitForEvent('dialog').then(async dialog=>{
      const message=dialog.message();
      await dialog.accept();
      return message;
    }),
    p.waitForResponse(r=>r.url()===origin+'/api/data'&&r.request().method()==='PUT'),
    remove.click()
  ]);
  assert.equal(message,confirmation);
  assert.equal(version,previous+1);
  assert.deepEqual(data.subscriptions,preservedSubscriptions);
  assert.deepEqual(data.invoices,preservedInvoices);
  await p.reload();
  await p.locator('#sub-tbody').getByText('Synthetic Cedar Local',{exact:true}).waitFor();
  await row.waitFor({state:'detached'});
  await p.goto(origin+'/#invoices');
  await p.locator('#inv-empty').waitFor();
});

await test('team directory imports, filters and removes employees',async()=>{
  await p.goto(origin+'/#team');
  await p.reload();
  await p.locator('#team-file').waitFor({state:'attached'});
  const csv=[
    'Employee ID,Email,Title,Department',
    'SST-001,alex@example.invalid,"Analyst, Senior",Finance',
    'SST-002,jordan@example.invalid,Engineer,IT'
  ].join('\n');
  await Promise.all([
    p.waitForResponse(workspaceWrite),
    p.locator('#team-file').setInputFiles({name:'synthetic-team.csv',mimeType:'text/csv',buffer:Buffer.from(csv)})
  ]);
  assert.deepEqual(data.employees.map(({employeeId,title,department})=>({employeeId,title,department})),[
    {employeeId:'SST-001',title:'Analyst, Senior',department:'Finance'},
    {employeeId:'SST-002',title:'Engineer',department:'IT'}
  ]);

  const table=p.locator('#team-tbody');
  const finance=table.getByRole('row').filter({hasText:'SST-001'});
  const it=table.getByRole('row').filter({hasText:'SST-002'});
  await p.reload();
  await it.waitFor();
  await p.locator('#team-filter-dept').selectOption('Finance');
  await finance.waitFor();
  await it.waitFor({state:'detached'});
  await Promise.all([
    p.waitForResponse(workspaceWrite),
    finance.getByRole('button',{name:'Remove',exact:true}).click()
  ]);
  assert.deepEqual(data.employees.map(e=>e.employeeId),['SST-002']);
  await p.reload();
  await it.waitFor();
  await finance.waitFor({state:'detached'});
  const rollup=p.locator('#team-rollup-tbody tr').filter({hasText:'IT'});
  assert.equal(await rollup.locator('td').nth(1).textContent(),'1');
});

await test('seat allocation changes persist and update unused spend',async()=>{
  await p.goto(origin+'/#subscriptions');
  await p.reload();
  const vendor=p.locator('#sub-tbody tr').filter({hasText:'Synthetic Cedar Local'});
  await vendor.waitFor();
  const modal=p.locator('#modal');
  const save=modal.getByRole('button',{name:'Save',exact:true});
  await vendor.getByRole('button',{name:'Edit',exact:true}).click();
  await p.locator('#f-name:focus').waitFor();
  await modal.locator('#f-lic-total').fill('10');
  await modal.locator('#f-lic-assigned').fill('8');
  await modal.locator('#f-lic-utilized').fill('6');
  await Promise.all([p.waitForResponse(workspaceWrite),save.click()]);
  await modal.waitFor({state:'hidden'});

  await p.goto(origin+'/#consumption');
  const usage=p.locator('#cons-tbody tr').filter({hasText:'Synthetic Cedar Local'});
  await usage.getByText('$48.00',{exact:true}).waitFor();
  await usage.getByRole('button',{name:'Edit seats',exact:true}).click();
  await p.locator('#f-name:focus').waitFor();
  await modal.locator('#f-lic-assigned').fill('7');
  await modal.locator('#f-lic-utilized').fill('5');
  await Promise.all([p.waitForResponse(workspaceWrite),save.click()]);
  const {licenses,assigned,utilized}=data.subscriptions.find(s=>s.id==='local-cedar');
  assert.deepEqual({licenses,assigned,utilized},{licenses:10,assigned:7,utilized:5});

  await p.reload();
  await usage.getByText('$60.00',{exact:true}).waitFor();
  assert.deepEqual((await usage.locator('td').allTextContents()).slice(2,9).map(text=>text.trim()),
    ['10','7','5','5','50%','$60.00','$720.00']);
});

await test('250-subscription workspace loads and filters accurately',async()=>{
  const subscriptionCount=250;
  data={
    ...data,
    subscriptions:Array.from({length:subscriptionCount},(_,index)=>({
      id:'bulk-'+index,
      name:'Bulk Vendor '+String(index+1).padStart(3,'0'),
      cost:120,
      currency:'USD',
      cycle:'monthly',
      active:true
    }))
  };
  const rows=p.locator('#sub-tbody tr');
  const waitForRows=count=>p.waitForFunction(expected=>
    document.querySelectorAll('#sub-tbody tr').length===expected, count);

  await p.goto(origin+'/#subscriptions');
  const loadStart=performance.now();
  await p.reload();
  await waitForRows(subscriptionCount);
  const loadMs=Math.round(performance.now()-loadStart);
  assert.equal(await rows.first().locator('td').first().getByText('Bulk Vendor 001',{exact:true}).count(),1);

  const search=p.locator('#search');
  const filterStart=performance.now();
  await search.fill('Bulk Vendor 250');
  await waitForRows(1);
  await rows.getByText('Bulk Vendor 250',{exact:true}).waitFor();
  const filterMs=Math.round(performance.now()-filterStart);

  const clearStart=performance.now();
  await search.fill('');
  await waitForRows(subscriptionCount);
  const clearMs=Math.round(performance.now()-clearStart);

  const timings={engine,subscriptionCount,loadMs,filterMs,clearMs};
  console.log('250-subscription timings (ms)',JSON.stringify(timings));
  await fs.writeFile(path.join(out,'large-workspace.json'),JSON.stringify(timings,null,2));
});

await test('owner lifetime badge and explicit OAuth connections',async()=>{
  authFixture='owner';
  await p.goto(origin+'/?fixture=owner#subscriptions');
  await p.getByText('Platform Owner — Lifetime Access',{exact:true}).waitFor();
  assert.equal(await p.locator('#sst-upgrade').count(),0);
  assert.equal(await p.locator('[data-view="pricing"]:visible').count(),0);
  const google=p.locator('#sst-connected-sign-in button').filter({hasText:'Connect Google'});
  assert.equal(await google.evaluate(button=>button.form.method),'post');
  assert.ok((await google.evaluate(button=>button.form.action)).endsWith('/api/auth/oauth/google/start'));
});
await test('Google, Microsoft and email choices on sign-in',async()=>{
  authFixture='anonymous';
  await p.reload();
  await p.getByRole('button',{name:'Email me a sign-in link',exact:true}).waitFor();
  for(const provider of ['Google','Microsoft']){
    const button=p.getByRole('button',{name:'Continue with '+provider,exact:true});
    await button.waitFor();
    assert.equal(await button.evaluate(el=>el.form.method),'get');
    assert.ok((await button.evaluate(el=>el.form.action)).endsWith('/api/auth/oauth/'+provider.toLowerCase()+'/start'));
  }
});
await browser.close();server.close();process.exitCode=results.some(r=>r.status==='failed')?1:0;
