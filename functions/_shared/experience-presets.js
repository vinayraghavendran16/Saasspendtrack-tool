const presets=Object.freeze({
 cro:['executive-overview','technology-portfolio','budgets','decisions','reports'],
 revops:['action-centre','technology-portfolio','licence-usage','renewals','scenarios'],
 cfo:['executive-overview','spend-analytics','budgets','savings-roi','approvals'],
 it:['technology-portfolio','dependency-map','licence-usage','risk','data-sources'],
 procurement:['vendors','contracts','renewals','playbook','approvals']
});
// allowedPages must come from server authorization, never persona selection.
// This helper controls presentation only; every API independently authorizes access.
export function experiencePreset(persona,allowedPages){
 if(!Array.isArray(allowedPages))return [];
 const allowed=new Set(allowedPages);
 return (Object.hasOwn(presets,persona)?presets[persona]:['my-workspace']).filter(page=>allowed.has(page));
}
