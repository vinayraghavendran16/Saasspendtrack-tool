import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium,firefox,webkit} from 'playwright';
const assets=new Set(['financial-intelligence.html','financial-intelligence.css','financial-entry.js','financial-pupm.js','financial-pupm-trend.js','financial-money-format.js','financial-intelligence.js']);
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname.slice(1);
 if(!assets.has(path)){res.writeHead(404).end();return;}
 try{res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(await readFile(new URL('../../'+path,import.meta.url)));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
try{
 for(const engine of [chromium,firefox,webkit]){
 const browser=await engine.launch({headless:true});
 try{
 for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('https://fonts.googleapis.com/**',route=>route.abort());
 await page.route('https://fonts.gstatic.com/**',route=>route.abort());
 let enabled=false;
 const metric={currency:'USD',amountMinor:'4950000',pupmMinor:{numerator:'4950000',denominator:'210'}};
 await page.route('**/api/financial/**',async route=>{
 const path=new URL(route.request().url()).pathname.split('/').pop();
 if(path==='capabilities')return route.fulfill(enabled?{json:{financialIntelligence:true,pupm:true,reviews:false}}:{status:404,body:''});
 if(path==='pupm')return route.fulfill({json:{population:{status:'available'},metrics:[metric]}});
 if(path==='population')return route.fulfill({json:{observations:[]}});
 if(path==='pupm-trend')return route.fulfill({json:{currency:'USD',periods:[{month:'2020-01',metric,status:'observed',changeBasisPoints:null},{month:'2020-02',metric:null,status:'missing',changeBasisPoints:null},{month:'2020-03',metric,status:'observed',changeBasisPoints:null}]}});
 return route.fulfill({status:404});
 });
 await page.goto(base+'/financial-intelligence.html');
 await page.locator('#financial-access').filter({hasText:'could not be opened'}).waitFor();
 assert.equal(await page.locator('#pupm-entry').isVisible(),false);
 enabled=true;await page.reload();
 await page.locator('#pupm-results').getByText('USD 235.71').waitFor();
 assert.equal(await page.locator('#reviews').isVisible(),false);
 await page.locator('#trend-form button').click();
 await page.locator('#trend-chart svg').waitFor();
 assert.equal(await page.locator('#trend-chart svg circle').count(),2);
 assert.equal(await page.locator('#trend-chart svg line').count(),1);
 assert.equal(await page.locator('#trend-results tr').count(),3);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 assert.deepEqual(audit.violations.map(v=>({id:v.id,impact:v.impact})),[]);
 await page.locator('#trend-form [name="currency"]').fill('EUR');
 assert.equal(await page.locator('#trend-chart svg').count(),0);
 assert.equal(await page.locator('#trend-results tr').count(),0);
 await page.close();
 }
 }finally{await browser.close();}
 }
}finally{await new Promise(r=>server.close(r));}
console.log('Financial browser fixtures passed');
