const el=id=>document.getElementById(id);
const form=el('renewal-filter'),panel=el('renewal-panel'),results=el('renewal-results'),status=el('renewal-status');
const day=86400000, today=Math.floor(Date.now()/day)*day;
const date=ms=>new Date(ms).toISOString().slice(0,10);
form.elements.start.value=date(today-30*day);form.elements.end.value=date(today-day);
form.elements.end.max=date(today-day);form.elements.start.max=date(today-day);
let generation=0,controller;
function clearPrivateView(message='Checking access…'){generation++;controller?.abort();panel.hidden=true;results.hidden=true;el('renewal-kpis').replaceChildren();el('renewal-bars').replaceChildren();for(const id of ['renewal-metrics','renewal-decisions','renewal-challenges'])el(id).replaceChildren();el('renewal-cutoff').textContent='';status.textContent=message;}
function onLifecycle(){clearPrivateView();if(document.visibilityState==='visible')load();}
window.addEventListener('pagehide',()=>clearPrivateView('Session verification required.'));
window.addEventListener('pageshow',e=>{if(e.persisted)onLifecycle();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')clearPrivateView('Session verification required.');else onLifecycle();});
const pct=v=>v===null?'Not available':new Intl.NumberFormat(undefined,{style:'percent',maximumFractionDigits:1}).format(v);
function table(id,rows){const body=el(id);body.replaceChildren();for(const [label,value] of rows){const tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');th.scope='row';th.textContent=label;td.textContent=String(value);tr.append(th,td);body.append(tr);}}
function visuals(d){
 const k=el('renewal-kpis'),bars=el('renewal-bars');k.replaceChildren();bars.replaceChildren();
 for(const [label,value] of [['Recommendations',d.recommendations],['Response rate',pct(d.responseRate)],['Acceptance among respondents',pct(d.acceptanceRateAmongResponded)],['Challenge resolution',pct(d.resolutionRate)]]){
 const card=document.createElement('div'),name=document.createElement('span'),number=document.createElement('strong');card.className='renewal-kpi';name.textContent=label;number.textContent=String(value);card.append(name,number);k.append(card);}
 for(const [label,value] of [['Accepted',d.accepted],['Rejected',d.rejected],['Deferred',d.deferred],['Ambiguous',d.ambiguousResponses],['Awaiting response',d.recommendations-d.responded]]){
 const row=document.createElement('div'),heading=document.createElement('div'),name=document.createElement('span'),count=document.createElement('span'),bar=document.createElement('progress');heading.className='renewal-bar-label';name.textContent=label;count.textContent=String(value);heading.append(name,count);bar.max=Math.max(1,d.recommendations);bar.value=value;bar.dataset.kind=label;row.append(heading,bar);bars.append(row);}
}
async function load(){
 const current=++generation;controller?.abort();controller=new AbortController();
 if(document.visibilityState==='hidden'){clearPrivateView('Session verification required.');return;}
 results.hidden=true;status.textContent='Loading renewal analytics…';
 const start=Date.parse(form.elements.start.value+'T00:00:00Z'),end=Date.parse(form.elements.end.value+'T00:00:00Z')+day;
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>366*day||end>Date.now()){status.textContent='Choose a valid period of up to 366 completed UTC days.';return;}
 try{
 const r=await fetch('/api/renewals/ai-analytics?'+new URLSearchParams({start:String(start),end:String(end)}),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
 if(current!==generation)return;
 if([401,403,404].includes(r.status)){panel.hidden=true;status.textContent='Renewal analytics is not available for this session.';return;}
 panel.hidden=false;
 if(!r.ok){status.textContent=r.status===422?'Too many records. Choose a shorter reporting period.':'Unable to load analytics. Try again.';return;}
 const d=await r.json();if(current!==generation)return;
 if(d.definitionVersion!==1||!Number.isSafeInteger(d.recommendations)||d.recommendations<0)throw Error('invalid analytics');
 table('renewal-metrics',[['Published recommendations',d.recommendations],['Response rate',pct(d.responseRate)],['Acceptance among respondents',pct(d.acceptanceRateAmongResponded)],['Median first response',d.medianFirstResponseMs===null?'Not available':(d.medianFirstResponseMs/day).toFixed(2)+' days']]);
 table('renewal-decisions',[['Accepted',d.accepted],['Rejected',d.rejected],['Deferred',d.deferred],['Ambiguous response',d.ambiguousResponses],['Awaiting response',d.recommendations-d.responded]]);
 table('renewal-challenges',[['Recommendations challenged',d.challenged],['Challenge rate',pct(d.challengeRate)],['Total challenges',d.challengeCount],['Resolved challenges',d.resolvedChallenges],['Resolution rate',pct(d.resolutionRate)],['Blocking challenges',d.blockingChallenges],['Ever approved',d.everApproved],['Execution recorded',d.everExecutionRecorded]]);
 el('renewal-cutoff').textContent='Observed through '+new Date(d.asOf).toISOString();
 visuals(d);results.hidden=false;status.textContent=d.recommendations?'Analytics loaded.':'No recommendations published in this period.';
 }catch(e){if(current!==generation||e.name==='AbortError')return;status.textContent='Unable to load analytics. Try again.';}
}
form.addEventListener('submit',e=>{e.preventDefault();load();});
form.addEventListener('input',()=>{const wasVisible=!panel.hidden;clearPrivateView('Apply dates to refresh analytics.');if(wasVisible)panel.hidden=false;});
load();
