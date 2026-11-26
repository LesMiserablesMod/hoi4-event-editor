import {localisationCode,localisationIssue,namespaceOf,scriptCode} from './engine.mjs';
import {parseOption} from './options.mjs';

export function eventFileBase(doc,workspace){
 const stem=d=>d.id.replaceAll('.','_');
 const base=stem(doc),siblings=workspace.filter(d=>stem(d).toLowerCase()===base.toLowerCase());
 return siblings.length>1?base+'~'+(siblings.findIndex(d=>d.uid===doc.uid)+1):base;
}

export function gameFile(docs,kind,base,idIssue){
 const loc=kind==='loc';
 const name=base+(loc?'_l_simp_chinese.yml':'.txt');
 const issues=[];
 for(const d of docs){
  const idProblem=idIssue(d);if(idProblem)issues.push(d.id+' · '+idProblem);
  if(loc){
   const fields=[['t',d.title],['d',d.desc],...d.options.map(o=>[o.key,o.text])];
   for(const [key,text] of fields){
    const problem=localisationIssue(text);if(problem)issues.push(d.id+'.'+key+' · '+problem);
   }
  }else for(const o of d.options){
   const {issue}=parseOption(o.extra);if(issue)issues.push(d.id+'.'+o.key+' · '+issue);
  }
 }
 return {kind,name,path:(loc?'localisation/simp_chinese/':'events/')+name,
  text:loc?localisationCode(docs):scriptCode(docs),bom:loc,issues};
}

export function selectedFiles(docs,separate,workspace,idIssue){
 if(!docs.length)return [];
 const groups=separate?docs.map(d=>[d]):[docs];
 return groups.flatMap(group=>{
  const namespaces=new Set(group.map(d=>namespaceOf(d.id)));
  const base=group.length===1?eventFileBase(group[0],workspace):
   (namespaces.size===1?namespaceOf(group[0].id).replaceAll('.','_'):'dispatch')+'_events';
  return ['script','loc'].map(kind=>gameFile(group,kind,base,idIssue));
 });
}

export function fileBlob(file){
 return new Blob([file.bom?'\uFEFF':'',file.text],{type:'text/plain;charset=utf-8'});
}

export function downloadBlob(name,blob){
 const link=document.createElement('a'),url=URL.createObjectURL(blob);
 link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
