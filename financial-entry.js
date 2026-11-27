const status=document.getElementById('financial-access');
try{
 const r=await fetch('/api/financial/capabilities',{credentials:'same-origin',cache:'no-store'});
 if(!r.ok)throw Error('Financial Intelligence is unavailable for this session.');
 const flags=await r.json();
 if(flags.financialIntelligence!==true)throw Error('Financial Intelligence is unavailable.');
 if(flags.reviews===true){await import('./financial-intelligence.js');document.querySelectorAll('[data-financial-feature="reviews"]').forEach(e=>e.hidden=false);}
 if(flags.pupm===true){await import('./financial-pupm.js');await import('./financial-pupm-trend.js');document.querySelectorAll('[data-financial-feature="pupm"]').forEach(e=>e.hidden=false);}
 status.textContent='';
}catch(e){status.textContent='Financial Intelligence could not be opened. Return to your workspace and check access.';}
