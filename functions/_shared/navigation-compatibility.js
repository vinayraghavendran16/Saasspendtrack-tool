// Only unambiguous aliases; overlapping surfaces require parity review.
const aliases=Object.freeze({'dashboard':'executive-overview','command-centre':'action-centre','subscriptions':'technology-portfolio','consumption':'licence-usage','team':'team-directory','analytics':'spend-analytics','pricing':'plans','reporting':'reports'});
export function resolveNavigation(page,visibleGroups){
 if(typeof page!=='string'||!Array.isArray(visibleGroups))return null;
 const canonical=Object.hasOwn(aliases,page)?aliases[page]:page;
 return visibleGroups.some(g=>Array.isArray(g.pages)&&g.pages.includes(canonical))?canonical:null;
}
