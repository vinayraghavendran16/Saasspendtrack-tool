import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import {parseUsPreviewUrl} from '../../scripts/preview-api-target.mjs';
const origin=parseUsPreviewUrl(process.env.PREVIEW_URL).origin;
const profile=process.env.E2E_PROFILE;if(!profile)throw Error('E2E_PROFILE must name a dedicated test-only directory');
const output=process.env.E2E_OUTPUT||'test-results/auth';await fs.mkdir(output,{recursive:true});
await fs.mkdir(profile,{recursive:true,mode:0o700});
const context=await chromium.launchPersistentContext(profile,{
 ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),
 headless:false, chromiumSandbox:true, ignoreHTTPSErrors:false, viewport:{width:1440,height:1000},
});
const responses=[];
await context.route('**/*',async route=>{
 const u=new URL(route.request().url());
 const allowed=u.origin===origin || (u.protocol==='https:' && (u.hostname.endsWith('.cloudflareaccess.com') || ['challenges.cloudflare.com','fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname)));
 if(allowed) await route.continue(); else { console.log('Blocked external host:',u.hostname); await route.abort(); }
});
const page=context.pages()[0] || await context.newPage();
page.on('response',r=>{const u=new URL(r.url()); responses.push({host:u.hostname,path:u.pathname,status:r.status()});});
try {
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:45000});
 console.log('Current host:',new URL(page.url()).hostname);
 console.log('Page title:',await page.title());
 await page.screenshot({path:output+'/auth-required.png'});
 await fs.writeFile(output+'/auth-network.json',JSON.stringify(responses,null,2));
 console.log('Dedicated browser ready. Manual Cloudflare Access authentication required if sign-in is shown. No existing Chrome profile accessed.');
} catch(e) { console.log('Navigation failure:',e.name); }
setInterval(async()=>{try { const u=new URL(page.url()); await fs.writeFile(output+'/browser-status.json',JSON.stringify({host:u.hostname,path:u.pathname,title:await page.title(),checkedAt:new Date().toISOString()})); } catch {} },2000);
process.on('SIGTERM',async()=>{await context.close();process.exit(0)});
await new Promise(resolve=>context.on('close',resolve));
