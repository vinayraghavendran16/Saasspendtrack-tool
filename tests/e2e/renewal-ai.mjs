import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium,firefox,webkit} from 'playwright';
const assets=new Set(['renewal-ai-analytics.html','renewal-ai-dashboard.js','renewal-ai-dashboard.css','financial-intelligence.css']);
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname.slice(1);
 if(!assets.has(path))return res.writeHead(404).end();
 try{res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(await readFile(new URL('../../'+path,import.meta.url)));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const data={definitionVersion:1,recommendations:10,responded:8,accepted:5,rejected:2,deferred:1,ambiguousResponses:0,responseRate:.8,acceptanceRateAmongResponded:.625,medianFirstResponseMs:86400000,challenged:2,challengeRate:.2,challengeCount:3,resolvedChallenges:2,resolutionRate:2/3,blockingChallenges:1,everApproved:4,everExecutionRecorded:3,asOf:Date.now()};
try{for(const engine of [chromium,firefox,webkit]){
 const browser=await engine.launch();
 try{for(const width of [390,1280]){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
 let mode='denied';
 await page.route('**/api/renewals/ai-analytics?**',async route=>{
 const u=new URL(route.request().url());assert.ok(Number(u.searchParams.get('end'))>Number(u.searchParams.get('start')));assert.equal(u.searchParams.has('accountId'),false);
 if(mode==='denied')return route.fulfill({status:403});
 if(mode==='overflow')return route.fulfill({status:422});
 if(mode==='empty')return route.fulfill({json:{...data,recommendations:0,responded:0,accepted:0,rejected:0,deferred:0,challenged:0,challengeCount:0,resolvedChallenges:0,blockingChallenges:0,everApproved:0,everExecutionRecorded:0,responseRate:null,acceptanceRateAmongResponded:null,challengeRate:null,resolutionRate:null,medianFirstResponseMs:null}});
 return route.fulfill({json:data});
 });
 await page.goto(base+'/renewal-ai-analytics.html');
 await page.locator('#renewal-status').filter({hasText:'not available'}).waitFor();
 assert.equal(await page.locator('#renewal-panel').isVisible(),false);
 mode='normal';await page.reload();
 await page.locator('#renewal-status').filter({hasText:'Analytics loaded.'}).waitFor();
 assert.equal(await page.locator('.renewal-kpi').count(),4);
 assert.equal(await page.locator('#renewal-bars progress').count(),5);
 assert.equal(await page.locator('#renewal-decisions tr').count(),5);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 assert.deepEqual(audit.violations.map(v=>({id:v.id,impact:v.impact})),[]);
 await page.locator('[name=start]').fill('2020-01-01');
 assert.equal(await page.locator('#renewal-results').isVisible(),false);
 await page.locator('[name=end]').fill('2020-01-31');
 mode='overflow';await page.locator('#renewal-filter button').click();
 await page.locator('#renewal-status').filter({hasText:'Too many records'}).waitFor();
 assert.equal(await page.locator('#renewal-results').isVisible(),false);
 mode='empty';await page.locator('#renewal-filter button').click();
 await page.locator('#renewal-status').filter({hasText:'No recommendations'}).waitFor();
 assert.equal(await page.locator('#renewal-kpis').getByText('Not available',{exact:true}).count(),3);
 await context.close();console.log(engine.name()+' '+width+'px renewal checks passed');
 }}finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
