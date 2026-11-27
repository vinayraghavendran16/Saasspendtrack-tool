import {formatMinor} from './financial-money-format.js';
const form=document.getElementById('trend-form'),status=document.getElementById('trend-status'),table=document.getElementById('trend-results'),month=document.getElementById('pupm-month');
let generation=0;
function renderChart(periods,currency){
 const chart=document.getElementById('trend-chart');chart.replaceChildren();
 const ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 640 240');svg.setAttribute('width','100%');svg.setAttribute('role','img');svg.setAttribute('aria-label','Monthly cost per employee in '+currency+'; missing periods are gaps. Exact values in table.');
 const values=periods.map(p=>p.metric?Number(p.metric.pupmMinor.numerator)/Number(p.metric.pupmMinor.denominator):null);
 const valid=values.filter(v=>v!==null&&Number.isFinite(v));if(!valid.length){chart.textContent='No comparable observations.';return;}
 const low=Math.min(0,...valid),high=Math.max(0,...valid),span=high-low||1;
 const x=i=>40+i*560/Math.max(1,periods.length-1),y=v=>190-(v-low)/span*160;
 function add(tag,attrs,label){const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));if(label!==undefined)el.textContent=label;svg.append(el);}
 add('line',{x1:30,x2:610,y1:y(0),y2:y(0),stroke:'currentColor',opacity:.25});
 values.forEach((v,i)=>{
 if(v!==null&&Number.isFinite(v)){
 if(i&&values[i-1]!==null&&Number.isFinite(values[i-1]))add('line',{x1:x(i-1),y1:y(values[i-1]),x2:x(i),y2:y(v),stroke:'#2563eb','stroke-width':3});
 add('circle',{cx:x(i),cy:y(v),r:4,fill:'#2563eb'});
 }
 if(periods.length<=6||i%2===0||i===periods.length-1)add('text',{x:x(i),y:220,'text-anchor':'middle','font-size':11,fill:'currentColor'},periods[i].month.slice(2));
 });
 chart.append(svg);
}

function percent(v){if(v===null)return 'Unavailable';const n=BigInt(v),a=n<0n?-n:n;return (n<0n?'-':'')+String(a/100n)+'.'+String(a%100n).padStart(2,'0')+'%';}
async function load(){
 const seq=++generation,f=new FormData(form),q=new URLSearchParams({end:month.value,currency:f.get('currency'),months:f.get('months')});
 table.replaceChildren();document.getElementById('trend-chart').replaceChildren();status.textContent='Loading trend…';
 try{
 const r=await fetch('/api/financial/pupm-trend?'+q,{credentials:'same-origin',cache:'no-store'});
 if(!r.ok)throw Error('Trend unavailable ('+r.status+')');
 const data=await r.json();if(seq!==generation)return;
 renderChart(data.periods,data.currency);
 for(const p of data.periods){const tr=document.createElement('tr');for(const v of [p.month,p.metric?formatMinor(p.metric.pupmMinor.numerator,data.currency,p.metric.pupmMinor.denominator):'Unavailable',percent(p.changeBasisPoints),p.status]){const td=document.createElement('td');td.textContent=v;tr.append(td);}table.append(tr);}
 status.textContent='Observed invoices only; ledger completeness not established.';
 }catch(e){if(seq===generation)status.textContent=e.message;}
}
form.addEventListener('submit',e=>{e.preventDefault();load();});month.addEventListener('change',()=>{generation++;table.replaceChildren();document.getElementById('trend-chart').replaceChildren();status.textContent='Reporting month changed. Load trend to refresh.';});
