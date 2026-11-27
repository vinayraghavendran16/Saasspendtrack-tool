import {formatMinor} from './financial-money-format.js';
const form=document.getElementById('trend-form'),status=document.getElementById('trend-status'),table=document.getElementById('trend-results'),month=document.getElementById('pupm-month');
let generation=0;
function percent(v){if(v===null)return 'Unavailable';const n=BigInt(v),a=n<0n?-n:n;return (n<0n?'-':'')+String(a/100n)+'.'+String(a%100n).padStart(2,'0')+'%';}
async function load(){
 const seq=++generation,f=new FormData(form),q=new URLSearchParams({end:month.value,currency:f.get('currency'),months:f.get('months')});
 table.replaceChildren();status.textContent='Loading trend…';
 try{
 const r=await fetch('/api/financial/pupm-trend?'+q,{credentials:'same-origin',cache:'no-store'});
 if(!r.ok)throw Error('Trend unavailable ('+r.status+')');
 const data=await r.json();if(seq!==generation)return;
 for(const p of data.periods){const tr=document.createElement('tr');for(const v of [p.month,p.metric?formatMinor(p.metric.pupmMinor.numerator,data.currency,p.metric.pupmMinor.denominator):'Unavailable',percent(p.changeBasisPoints),p.status]){const td=document.createElement('td');td.textContent=v;tr.append(td);}table.append(tr);}
 status.textContent='Observed invoices only; ledger completeness not established.';
 }catch(e){if(seq===generation)status.textContent=e.message;}
}
form.addEventListener('submit',e=>{e.preventDefault();load();});month.addEventListener('change',()=>{generation++;table.replaceChildren();status.textContent='Reporting month changed. Load trend to refresh.';});
