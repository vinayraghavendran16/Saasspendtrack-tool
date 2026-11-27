import {formatMinor} from './financial-money-format.js';
const $=id=>document.getElementById(id);
const month=$('pupm-month'),status=$('pupm-status'),results=$('pupm-results'),observations=$('pupm-observations');
const d=new Date();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-1);month.value=month.max=d.toISOString().slice(0,7);
let generation=0,busy=false;
async function api(path,body){
 const r=await fetch('/api/financial/'+path,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Error('Request unavailable ('+r.status+')');
 return r.json();
}
function node(tag,value){const el=document.createElement(tag);el.textContent=value;return el;}
async function load(){
 const seq=++generation,m=month.value;results.replaceChildren();observations.replaceChildren();status.textContent='Loading…';
 try{
 const q='?month='+encodeURIComponent(m),[p,o]=await Promise.all([api('pupm'+q),api('population'+q)]);
 if(seq!==generation||m!==month.value)return;
 status.textContent=p.population.status+' · '+(p.population.selectionStatus||'no source selection')+' · completeness not established';
 for(const r of p.metrics){const tr=node('tr','');for(const v of [r.currency,formatMinor(r.amountMinor,r.currency),r.pupmMinor.denominator,formatMinor(r.pupmMinor.numerator,r.currency,r.pupmMinor.denominator)])tr.append(node('td',v));results.append(tr);}
 for(const r of o.observations.filter(x=>x.denominator==='employees')){
 const div=node('div','');div.append(node('p',r.source_id+' · '+r.population+' employees'));
 const reason=node('input','');reason.placeholder='Selection rationale';reason.maxLength=1000;reason.setAttribute('aria-label','Selection rationale for '+r.source_id);
 const button=node('button','Select source');button.type='button';button.addEventListener('click',async()=>{if(busy||m!==month.value||!reason.value.trim())return;busy=true;button.disabled=true;try{await api('population-selection',{observationId:r.id,reason:reason.value});document.dispatchEvent(new Event('financial-population-changed'));await load();}catch(e){status.textContent=e.message;}finally{busy=false;button.disabled=false;}});
 div.append(reason,button);observations.append(div);
 }
 }catch(e){if(seq===generation)status.textContent=e.message;}
}
$('pupm-filter').addEventListener('submit',e=>{e.preventDefault();load();});
month.addEventListener('change',load);
$('pupm-entry').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;const f=new FormData(e.currentTarget);try{await api('population',{month:month.value,denominator:'employees',count:Number(f.get('count')),sourceId:f.get('sourceId'),sourceRecordId:f.get('sourceRecordId')});document.dispatchEvent(new Event('financial-population-changed'));await load();}catch(e){status.textContent=e.message;}finally{busy=false;}});
load();
