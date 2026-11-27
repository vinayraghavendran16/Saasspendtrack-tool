const groups=[
 ['overview',['my-workspace','executive-overview','action-centre']],
 ['technology',['technology-portfolio','vendors','licence-usage','dependency-map']],
 ['financials',['spend-analytics','invoices','budgets','savings-roi','forecasting']],
 ['contracts-risk',['contracts','renewals','risk','playbook']],
 ['decisions',['decisions','scenarios','approvals','decision-history']],
 ['reporting',['reports','report-builder','scheduled-reports']],
 ['people',['departments','team-directory','vendor-contacts']],
 ['administration',['settings','data-sources','integrations','access','plans']]
];
export function visibleModules({authorizedPages,enabledPages}={}){
 if(!Array.isArray(authorizedPages)||!Array.isArray(enabledPages))return [];
 const authorized=new Set(authorizedPages),enabled=new Set(enabledPages);
 return groups.map(([id,pages])=>({id,pages:pages.filter(p=>authorized.has(p)&&enabled.has(p))})).filter(g=>g.pages.length);
}
