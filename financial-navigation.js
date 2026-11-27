let generation=0;
export async function refreshFinancialNavigation(){
 const seq=++generation;
 const id='financial-intelligence-nav';
 document.getElementById(id)?.remove();
 try{
 const response=await fetch('/api/financial/capabilities',{credentials:'same-origin',cache:'no-store'});
 if(!response.ok)return;
 const flags=await response.json();if(seq!==generation||flags.financialIntelligence!==true)return;
 const anchor=document.querySelector('.sidebar [data-view="reporting"]')||document.querySelector('.sidebar [data-view="analytics"]');
 if(!anchor?.parentElement||document.getElementById(id))return;
 const link=document.createElement('a');link.id=id;link.className='tab';link.href='/financial-intelligence.html';link.textContent='Financial Intelligence';
 anchor.after(link);
 }catch{ /* Fail closed. */ }
}

export function clearFinancialNavigation(){generation++;document.getElementById('financial-intelligence-nav')?.remove();}
