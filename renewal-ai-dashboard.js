const el=id=>document.getElementById(id);
const form=el('renewal-filter'),panel=el('renewal-panel'),results=el('renewal-results'),status=el('renewal-status');
const day=86400000, today=Math.floor(Date.now()/day)*day;
const date=ms=>new Date(ms).toISOString().slice(0,10);
form.elements.start.value=date(today-30*day);form.elements.end.value=date(today-day);
form.elements.end.max=date(today-day);form.elements.start.max=date(today-day);
let generation=0,controller,registerController,registerCursor='',registerWindow=null;
const registerButton=el('renewal-register-load'),registerStatus=el('renewal-register-status');
let detailController,detailTrigger,evidenceController;
function resetEvidence(){evidenceController?.abort();evidenceController=null;}
function resetDetail(){resetEvidence();detailController?.abort();detailController=null;detailTrigger=null;el('renewal-detail').hidden=true;el('renewal-detail-content').replaceChildren();el('renewal-detail-status').textContent='';}
function resetRegister(){resetDetail();registerController?.abort();registerController=null;registerCursor='';registerWindow=null;el('renewal-register').replaceChildren();registerStatus.textContent='';registerButton.disabled=false;registerButton.textContent='Load recommendations';}

function clearPrivateView(message='Checking access…'){generation++;controller?.abort();resetRegister();panel.hidden=true;results.hidden=true;el('renewal-kpis').replaceChildren();el('renewal-bars').replaceChildren();for(const id of ['renewal-metrics','renewal-decisions','renewal-challenges'])el(id).replaceChildren();el('renewal-cutoff').textContent='';status.textContent=message;}
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
 resetRegister();const current=++generation;controller?.abort();controller=new AbortController();
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
 visuals(d);registerWindow={start:String(start),end:String(end)};results.hidden=false;status.textContent=d.recommendations?'Analytics loaded.':'No recommendations published in this period.';
 }catch(e){if(current!==generation||e.name==='AbortError')return;status.textContent='Unable to load analytics. Try again.';}
}
form.addEventListener('submit',e=>{e.preventDefault();load();});
form.addEventListener('input',()=>{const wasVisible=!panel.hidden;clearPrivateView('Apply dates to refresh analytics.');if(wasVisible)panel.hidden=false;});
load();

registerButton.addEventListener('click',async()=>{
 if(!registerWindow||results.hidden||document.visibilityState==='hidden')return;
 const current=generation,window=registerWindow,cursor=registerCursor;
 registerController?.abort();const requestController=new AbortController();registerController=requestController;
 registerButton.disabled=true;registerStatus.textContent='Loading recommendations…';
 try{
 const r=await fetch('/api/renewals/ai-recommendations?'+new URLSearchParams({...window,cursor}),{credentials:'same-origin',cache:'no-store',signal:requestController.signal});
 if(current!==generation||registerController!==requestController)return;
 if([401,403,404].includes(r.status)){clearPrivateView('Renewal analytics is not available for this session.');return;}
 if(!r.ok)throw Error('register unavailable');
 const d=await r.json();if(current!==generation||registerController!==requestController)return;
 if(!Array.isArray(d.records)||d.records.length>50||!(d.nextCursor===null||typeof d.nextCursor==='string')||d.nextCursor===cursor||d.records.some(x=>typeof x.recommendation_id!=='string'||typeof x.contract_id!=='string'||!Number.isSafeInteger(x.revision)||x.revision<1||!Number.isSafeInteger(x.published_at)))throw Error('invalid register');
 const fragment=document.createDocumentFragment();
 for(const x of d.records){const tr=document.createElement('tr');const cell=document.createElement('td'),button=document.createElement('button');button.type='button';button.textContent=x.recommendation_id;button.addEventListener('click',()=>loadDetail(x,button));cell.append(button);tr.append(cell);for(const value of [x.revision,x.contract_id,new Date(x.published_at).toISOString()]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}fragment.append(tr);}
 el('renewal-register').append(fragment);registerCursor=d.nextCursor;registerButton.textContent='Load next page';registerButton.disabled=d.nextCursor===null;registerStatus.textContent=d.records.length?d.records.length+' recommendations loaded.'+(d.nextCursor===null?' End of register.':''):'No further recommendations.';
 }catch(e){if(current!==generation||registerController!==requestController||e.name==='AbortError')return;registerStatus.textContent='Unable to load recommendations. Try again.';registerButton.disabled=false;}
});

el('renewal-detail-close').addEventListener('click',()=>{const trigger=detailTrigger;resetDetail();trigger?.focus();});
async function loadDetail(record,trigger){
 resetDetail();detailTrigger=trigger;const current=generation,ctrl=new AbortController();detailController=ctrl;
 const panel=el('renewal-detail'),status=el('renewal-detail-status'),content=el('renewal-detail-content');panel.hidden=false;status.textContent='Loading explanation…';el('renewal-detail-title').focus();
 try{
 const r=await fetch('/api/renewals/ai-recommendation-detail?'+new URLSearchParams({id:record.recommendation_id,revision:String(record.revision)}),{credentials:'same-origin',cache:'no-store',signal:ctrl.signal});
 if(current!==generation||detailController!==ctrl)return;
 if([401,403].includes(r.status)){clearPrivateView('Renewal analytics is not available for this session.');return;}
 if(!r.ok)throw Error('detail unavailable');
 const d=await r.json();if(current!==generation||detailController!==ctrl)return;
 if(d.recommendationId!==record.recommendation_id||d.revision!==record.revision||typeof d.rationale!=='string'||!Array.isArray(d.assumptions)||!Array.isArray(d.limitations)||!Array.isArray(d.evidence)||d.evidence.length>20)throw Error('invalid detail');
 const fragment=document.createDocumentFragment();
 function paragraph(value){const p=document.createElement('p');p.textContent=String(value);fragment.append(p);}
 function section(title,values){const h=document.createElement('h3');h.textContent=title;fragment.append(h);if(!values.length){paragraph('None recorded.');return;}const ul=document.createElement('ul');for(const value of values){const li=document.createElement('li');li.textContent=String(value);ul.append(li);}fragment.append(ul);}
 paragraph(d.recommendationId+' · Revision '+d.revision);paragraph('Model version: '+d.modelVersion);section('Why this recommendation?',[d.rationale]);section('Assumptions',d.assumptions);section('Limitations',d.limitations);const heading=document.createElement('h3');heading.textContent='Evidence references';fragment.append(heading);const output=document.createElement('div');output.setAttribute('role','status');for(const e of d.evidence){const p=document.createElement('p'),b=document.createElement('button');b.type='button';b.textContent='View '+e.artifact_type+' · '+e.evidence_kind;b.disabled=e.availability!=='available';p.append(b);if(b.disabled)p.append(document.createTextNode(' — unavailable'));b.addEventListener('click',()=>loadEvidence(record,e,output));fragment.append(p);}fragment.append(output);paragraph('Evidence availability is not a guarantee that the recommendation is correct.');
 content.replaceChildren(fragment);status.textContent='Explanation loaded.';mountChallenge(record,content,ctrl);
 }catch(e){if(current!==generation||detailController!==ctrl||e.name==='AbortError')return;status.textContent='Unable to load explanation. Select the recommendation to retry.';}
}

async function loadEvidence(record,evidence,output){
 resetEvidence();const ctrl=new AbortController();evidenceController=ctrl;const current=generation,detail=detailController;
 output.replaceChildren();output.textContent='Verifying source evidence…';
 try{
 const r=await fetch('/api/renewals/ai-evidence?'+new URLSearchParams({id:record.recommendation_id,revision:String(record.revision),evidenceId:evidence.id}),{credentials:'same-origin',cache:'no-store',signal:ctrl.signal});
 if(current!==generation||detailController!==detail||evidenceController!==ctrl)return;
 if([401,403].includes(r.status)){clearPrivateView('Renewal analytics is not available for this session.');return;}
 if(!r.ok){output.textContent='Source evidence is unavailable or could not be verified.';return;}
 const d=await r.json();if(current!==generation||detailController!==detail||evidenceController!==ctrl)return;
 if(d.recommendationId!==record.recommendation_id||d.revision!==record.revision||d.evidenceId!==evidence.id||d.verification!=='verified_text_span'||typeof d.quote!=='string'||d.quote.length>4000||!Number.isSafeInteger(d.page)||d.page<1||!Number.isSafeInteger(d.start)||!Number.isSafeInteger(d.end)||d.start<0||d.end-d.start!==d.quote.length||! /^[a-f0-9]{64}$/.test(d.artifactDigest))throw Error('invalid evidence');
 const label=document.createElement('p'),quote=document.createElement('blockquote'),version=document.createElement('p');label.textContent='Verified extracted text · Page '+d.page+' · '+d.artifactType;quote.textContent=d.quote;version.textContent='Extracted-text SHA-256: '+d.artifactDigest;version.style.overflowWrap='anywhere';output.replaceChildren(label,quote,version);
 }catch(e){if(current!==generation||detailController!==detail||evidenceController!==ctrl||e.name==='AbortError')return;output.textContent='Unable to verify source evidence. Try again.';}
}

function mountChallenge(record,content,ctrl){
 const form=document.createElement('form'),h=document.createElement('h3'),label=document.createElement('label'),select=document.createElement('select'),reasonLabel=document.createElement('label'),reason=document.createElement('textarea'),submit=document.createElement('button'),status=document.createElement('p');
 h.textContent='Challenge this recommendation';label.textContent='Challenge category ';reasonLabel.textContent='Reason ';reason.required=true;reason.maxLength=4000;submit.type='submit';submit.textContent='Submit challenge';status.setAttribute('role','status');
 for(const [value,name] of [['source_accuracy','Source accuracy'],['interpretation','Interpretation'],['assumption','Assumption'],['calculation','Calculation'],['completeness','Missing information'],['recommendation','Recommendation']]){const o=document.createElement('option');o.value=value;o.textContent=name;select.append(o);}
 label.append(select);reasonLabel.append(reason);form.append(h,label,reasonLabel,submit,status);content.append(form);
 form.addEventListener('submit',async e=>{
 e.preventDefault();if(submit.disabled||detailController!==ctrl||!reason.value.trim())return;
 submit.disabled=true;status.textContent='Submitting challenge…';
 try{const r=await fetch('/api/renewals/ai-challenges',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({recommendationId:record.recommendation_id,revision:record.revision,category:select.value,reason:reason.value}),signal:ctrl.signal});
 if(detailController!==ctrl)return;if([401,403].includes(r.status)){clearPrivateView('Session verification required.');return;}if(r.status!==201)throw Error('not committed');const d=await r.json();if(detailController!==ctrl)return;if(typeof d.challengeId!=='string')throw Error('invalid response');reason.value='';status.textContent='Challenge recorded. Approval is blocked pending appropriate resolution.';submit.disabled=false;
 }catch(e){if(detailController!==ctrl)return;status.textContent='Submission not confirmed. Check challenge history before retrying.';}
 });
}
