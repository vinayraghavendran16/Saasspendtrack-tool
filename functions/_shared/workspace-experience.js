import {visibleModules} from './module-registry.js';
import {experiencePreset} from './experience-presets.js';
import {resolveNavigation} from './navigation-compatibility.js';
export function workspaceExperience({authorizedPages,enabledPages,persona,pinnedPages}={}){
 const groups=visibleModules({authorizedPages,enabledPages});
 const pages=groups.flatMap(g=>g.pages);
 if(pinnedPages!==undefined&&(!Array.isArray(pinnedPages)||pinnedPages.length>30))throw Error('invalid pins');
 const pins=pinnedPages===undefined?experiencePreset(persona,pages):[...new Set(pinnedPages.map(p=>resolveNavigation(p,groups)).filter(Boolean))];
 return {groups,pins,landingPage:pins[0]??pages[0]??null};
}
