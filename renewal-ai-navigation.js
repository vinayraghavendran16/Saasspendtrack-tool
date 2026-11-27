let generation=0;
const id='renewal-ai-analytics-nav';
export function clearRenewalAINavigation(){generation++;document.getElementById(id)?.remove();}
export async function refreshRenewalAINavigation(){
 const seq=++generation;document.getElementById(id)?.remove();
 if(document.visibilityState==='hidden')return;
 try{
 const r=await fetch('/api/renewals/ai-analytics-capabilities',{credentials:'same-origin',cache:'no-store'});
 if(!r.ok)return;
 const flags=await r.json();
 if(seq!==generation||document.visibilityState==='hidden'||flags.renewalAiAnalytics!==true)return;
 const anchor=document.querySelector('.sidebar [data-view="renewals"]');
 if(!anchor?.parentElement||document.getElementById(id))return;
 const a=document.createElement('a');a.id=id;a.className='tab';a.href='/renewal-ai-analytics.html';a.textContent='Renewal AI Analytics';anchor.after(a);
 }catch{ /* No navigation without an authorized capability response. */ }
}
function refresh(){if(document.visibilityState==='visible')refreshRenewalAINavigation();else clearRenewalAINavigation();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
window.addEventListener('pageshow',refresh);
window.addEventListener('pagehide',clearRenewalAINavigation);
document.addEventListener('visibilitychange',refresh);
document.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('#sst-logout,[href="/api/auth/logout"]'))clearRenewalAINavigation();},true);
