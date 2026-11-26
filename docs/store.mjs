import {validId,identityKey,TYPE_NAMES} from './engine.mjs';
export const STORE='dispatchroom.workspace.v1';
export const uid=()=>globalThis.crypto?.randomUUID?.()||('d'+Date.now().toString(36)+Math.random().toString(36).slice(2));
export function makeDoc(id,kind='country_event',title=''){
 return {uid:uid(),id,kind,major:kind==='news_event',title,desc:'',picture:'',art:'',options:[{key:'a',text:'确定。',extra:''}],values:{}};
}
export function seeds(){
 const first=makeDoc('rhineland.1','news_event','莱茵兰再军事化');
 Object.assign(first,{art:'rhine',picture:'GFX_news_event_german_soldiers',desc:'清晨，德国军队越过莱茵河，进入了§8莱茵兰非军事区§!。科隆的钟声响起，人群聚集在街头，目送队伍沿河岸前行。\\n\\n消息传至巴黎与伦敦。面对这一既成事实，欧洲各国正等待§G英法两国的回应§!。',options:[{key:'a',text:'欧洲的平衡正在改变。',extra:''},{key:'b',text:'我们必须密切关注局势。',extra:''}]});
 first.options[0].extra='trigger = { NOT = { tag = FRA } }';
 first.options[1].extra='trigger = { tag = FRA }';
 const second=makeDoc('rhineland.2','country_event','巴黎的回应');
 Object.assign(second,{desc:'来自莱茵河畔的电报摆上了部长会议的长桌。§8外交部长§!宣读了伦敦方面的来信。\\n\\n有人主张立即照会对方，也有人坚持先听取议会的意见。',options:[{key:'a',text:'召集内阁会议。',extra:''},{key:'b',text:'与伦敦保持联系。',extra:''}]});
 const third=makeDoc('rhineland.3','country_event','伦敦的电报');
 Object.assign(third,{desc:'夜色笼罩白厅。一封标有§R加急§!的外交电报，送到了[ROOT.GetName]代表的手中。',values:{'[ROOT.GetName]':'英国'}});
 return {version:1,docs:[first,second,third],tabs:[first.uid,second.uid],active:first.uid,previewTag:'FRA',originalRecipient:true};
}
export function validWorkspace(w){
 const isObj=o=>o&&typeof o==='object'&&!Array.isArray(o);
 const validDoc=d=>isObj(d)&&typeof d.uid==='string'&&d.uid&&validId(d.id)&&Object.hasOwn(TYPE_NAMES,d.kind)&&
   (d.major===undefined||typeof d.major==='boolean')&&
   ['title','desc','picture','art'].every(k=>typeof d[k]==='string')&&(!d.picture||/^GFX_[\w.]+$/.test(d.picture))&&
   (['','rhine'].includes(d.art)||/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d.art))&&Array.isArray(d.options)&&d.options.length>0&&d.options.every(o=>isObj(o)&&typeof o.text==='string'&&typeof o.extra==='string'&&typeof o.key==='string'&&/^[a-z]+$/.test(o.key)&&o.key!=='t'&&o.key!=='d')&&
   new Set(d.options.map(o=>o.key)).size===d.options.length&&isObj(d.values)&&Object.values(d.values).every(x=>typeof x==='string');
 if(w?.modColors!==undefined&&(!isObj(w.modColors)||!Object.entries(w.modColors).every(([k,v])=>/^[a-z0-9]$/i.test(k)&&typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v))))return false;
 if(!isObj(w)||w.version!==1||!Array.isArray(w.docs)||!w.docs.every(validDoc))return false;
 if(w.previewTag!==undefined&&!/^[A-Z][A-Z0-9]{2}$/.test(w.previewTag))return false;
 if(w.originalRecipient!==undefined&&typeof w.originalRecipient!=='boolean')return false;
 const ids=new Set(w.docs.map(x=>x.uid));
 return ids.size===w.docs.length&&new Set(w.docs.map(x=>identityKey(x.id))).size===ids.size&&Array.isArray(w.tabs)&&w.tabs.every(t=>ids.has(t))&&new Set(w.tabs).size===w.tabs.length&&(w.active===null?!w.tabs.length:w.tabs.includes(w.active));
}
export function upgradeWorkspace(w){
 const example=seeds().docs[0];
 for(const d of w.docs){
  if(d.major!==undefined)continue;
  const pristine=['id','kind','title','desc','art','picture'].every(k=>d[k]===example[k])&&
    !Object.keys(d.values).length&&d.options.length===example.options.length&&
    d.options.every((o,i)=>o.key===example.options[i].key&&o.text===example.options[i].text&&o.extra==='');
  d.major=pristine;
  if(pristine)d.options.forEach((o,i)=>{o.extra=example.options[i].extra;});
 }
 w.previewTag??='FRA';w.originalRecipient??=true;
 return w;
}
export function readWorkspace(){
 try{const raw=localStorage.getItem(STORE);if(raw){const w=JSON.parse(raw);if(validWorkspace(w))return upgradeWorkspace(w);}}catch{}
 return seeds();
}
