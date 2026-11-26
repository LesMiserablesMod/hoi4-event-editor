import {COLORS,materialize,copyPart,applyColor,leaveColor,colorAt,syntaxRegion,toSourceText} from './engine.mjs';
import {esc} from './icons.mjs';

function partsHtml(parts,ctx,nested=false) {
 return parts.map(t=>{
  const d=t.display, ink=d.color||t.color, inkValue=ctx.colors?.[ink]||COLORS[ink]?.[1];
  const style=inkValue?' style="color:'+inkValue+'"':'';
  const map=nested?'':' data-a="'+t.from+'" data-b="'+t.to+'" data-k="'+t.kind+'"';
  if(t.kind==='break')return '<br'+map+'>';
  const atom=!['text','escape'].includes(t.kind);
  const hint=d.hint||([ 'scope','reference' ].includes(t.kind)?t.value:'');
  const inner=d.parts?partsHtml(d.parts,ctx,true):d.image?'<img class="inline-gfx" src="'+esc(d.image)+'" alt="'+esc(t.value)+'" draggable="false">':esc(d.text);
  return '<span'+map+style+(atom?' contenteditable="false"':'')+(hint?' title="'+esc(hint)+'"':'')+' class="'+(atom?'atom ':'')+(d.missing?'unresolved':'')+'">'+inner+'</span>';
 }).join('');
}
function sliceParts(parts,from,to){
 return parts.flatMap(t=>{
  if(t.to<=from||t.from>=to)return [];
  if(t.from>=from&&t.to<=to)return [t];
  if(t.kind!=='text')return [];
  const a=Math.max(t.from,from),b=Math.min(t.to,to),text=t.value.slice(a-t.from,b-t.from);
  return [{...t,from:a,to:b,value:text,display:{text}}];
 });
}
function localSource(raw,region,ctx){
 const {from,to,kind}=region;
 const span=(a,b,cls,ink='')=>a>=b?'':'<span data-k="text" data-local-source data-a="'+a+'" data-b="'+b+'" class="'+cls+'"'+(ink?' style="color:'+ink+'"':'')+'>'+esc(raw.slice(a,b))+'</span>';
 if(kind!=='color'||raw[from]!=='§'||!COLORS[raw[from+1]])return span(from,to,'syntax-source');
 const ink=ctx.colors?.[raw[from+1]]||COLORS[raw[from+1]][1];
 const tail=to-from>=4&&raw.slice(to-2,to)==='§!'?to-2:to;
 return span(from,from+2,'syntax-delimiter')+span(from+2,tail,'local-ink',ink)+span(tail,to,'syntax-delimiter');
}
export function paintField(el,raw,ctx={}){
 const parts=materialize(raw,ctx);
 const region=el._reveal;
 el.innerHTML=region?partsHtml(sliceParts(parts,0,region.from),ctx)+localSource(raw,region,ctx)+partsHtml(sliceParts(parts,region.to,raw.length),ctx):partsHtml(parts,ctx);
 el.dataset.empty=String(!parts.length&&!region);
 if(el.isContentEditable&&(!el.childNodes.length||el.lastElementChild?.tagName==='BR'))el.insertAdjacentHTML('beforeend','<span data-tail="true" aria-hidden="true">\u200b</span>');
}
function childOfField(el,node){
 if(!node||node===el)return null;
 let item=node.nodeType===1?node:node.parentElement;
 while(item&&item.parentNode!==el)item=item.parentElement;
 return item;
}
function offsetAt(el,node,offset,raw,end=false){
 const item=childOfField(el,node);
 if(item?.dataset.tail)return raw.length;
 if(item?.hasAttribute('data-a')){
  const a=Number(item.dataset.a), b=Number(item.dataset.b);
  if(item.dataset.k==='text'){
    if(node.nodeType===3)return Math.min(b,a+offset);
    return offset===0?a:b;
  }
  if(item.tagName==='BR')return end?b:a;
  const r=document.createRange();r.selectNodeContents(item);
  try{r.setEnd(node,offset);if(r.toString().length===0)return a;if(r.toString().length>=item.textContent.length)return b;}catch{}
  return end?b:a;
 }
 if(node===el){
  if(offset===0)return 0;
  if(offset>=el.childNodes.length)return raw.length;
  const prev=el.childNodes[offset-1], next=el.childNodes[offset];
  return Number((end?prev?.dataset?.b:next?.dataset?.a)??prev?.dataset?.b??raw.length);
 }
 return end?raw.length:0;
}
function domPoint(el,pos){
 let prev=null;
 for(const n of el.children){
  if(n.dataset.tail)return [n.firstChild,0];
  const a=Number(n.dataset.a),b=Number(n.dataset.b);
  if(pos<a)break;
  if(n.dataset.k==='text'&&pos<=b)return [n.firstChild,Math.max(0,pos-a)];
  if(pos===a)return [el,Array.prototype.indexOf.call(el.childNodes,n)];
  if(pos<b)return [el,Array.prototype.indexOf.call(el.childNodes,n)+1];
  prev=n;
 }
 if(prev?.dataset.k==='text')return [prev.firstChild,prev.textContent.length];
 const idx=prev?Array.prototype.indexOf.call(el.childNodes,prev)+1:0;
 return [el,idx];
}
export function rangeOf(el,raw){
 if(el.tagName==='TEXTAREA')return [el.selectionStart,el.selectionEnd];
 const sel=getSelection();
 if(!sel?.rangeCount)return null;
 const r=sel.getRangeAt(0);
 if(!el.contains(r.startContainer)||!el.contains(r.endContainer))return null;
 const a=offsetAt(el,r.startContainer,r.startOffset,raw);
 if(r.collapsed){
   const remembered=el._caret;
   if(remembered&&remembered.node===r.startContainer&&remembered.offset===r.startOffset)return [remembered.pos,remembered.pos];
   return [a,a];
 }
 return [a,offsetAt(el,r.endContainer,r.endOffset,raw,true)];
}
export function setCaret(el,pos){
 el.focus({preventScroll:true});
 if(el.tagName==='TEXTAREA'){el.setSelectionRange(pos,pos);return;}
 const [node,off]=domPoint(el,pos);const r=document.createRange();r.setStart(node,off);r.collapse(true);
 const sel=getSelection();sel.removeAllRanges();sel.addRange(r);el._caret={node,offset:off,pos};
}
function deleteSpan(raw,pos,back){
 const chunks=materialize(raw);
 const t=back?[...chunks].reverse().find(x=>x.from<pos):chunks.find(x=>x.to>pos);
 if(!t)return back?[0,pos]:[pos,raw.length];
 if(t.kind!=='text')return back?[t.from,pos]:[pos,t.to];
 const edge=Math.max(t.from,Math.min(t.to,pos));
 const segment=back?raw.slice(t.from,edge):raw.slice(edge,t.to);
 const units=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(segment)].map(x=>x.segment):Array.from(segment);
 return back?[edge-(units.at(-1)?.length||0),pos]:[pos,edge+(units[0]?.length||0)];
}
export function richController({getRaw,setRaw,context,showColorMenu,onInk}){
 let target='desc', held=null,composing=null,suppress=null,activeHost=null,pointerField=null;
 const histories=new Map();
 function editor(field){return [...document.querySelectorAll('[data-editor]')].find(x=>x.dataset.field===field);}
 function current(){
  const selected=held?.host;
  const el=(selected?.isConnected&&selected.dataset.field===target?selected:editor(target))||editor('desc');
  if(!el)return null;
  const raw=getRaw(el.dataset.field);
  const live=document.activeElement===el?rangeOf(el,raw):null;
  const bounds=live||(held?.field===el.dataset.field?held.bounds:null)||[raw.length,raw.length];
  return {el,raw,field:el.dataset.field,bounds:bounds.map(p=>Math.min(p,raw.length))};
 }
 function collapse(el){
  if(!el?._reveal)return;
  el._reveal=null;
  if(el.isConnected)paintField(el,getRaw(el.dataset.field),context());
  if(activeHost===el)activeHost=null;
 }
 function reveal(el,raw,region,pos){
  if(activeHost&&activeHost!==el)collapse(activeHost);
  const old=el._reveal;
  if(old?.from===region?.from&&old?.to===region?.to&&old?.kind===region?.kind)return;
  el._reveal=region;activeHost=region?el:null;
  paintField(el,raw,context());setCaret(el,pos);
  target=el.dataset.field;held={field:target,host:el,bounds:[pos,pos]};
 }
 const caretRegion=(raw,pos)=>pos>=2&&raw.slice(pos-2,pos)==='§!'?null:syntaxRegion(raw,pos);
 function apply(el,raw,pos,remember=true,edit=null){
  const field=el.dataset.field,before=getRaw(field);
  if(before!==raw&&remember){
   const h=histories.get(field)||{undo:[],redo:[]};h.undo.push({raw:before,pos:rangeOf(el,before)?.[0]??pos});if(h.undo.length>160)h.undo.shift();h.redo=[];histories.set(field,h);
  }
  if(before!==raw)setRaw(field,raw,el);
  if(el.tagName==='TEXTAREA'){if(el.value!==raw)el.value=raw;}
  else{
    const prev=el._reveal;
    if(prev&&edit&&edit[0]>=prev.from&&edit[1]<=prev.to&&edit[0]<prev.to){
      const end=prev.to+raw.length-before.length;
      el._reveal=end>prev.from?{...prev,to:end}:null;
    }else el._reveal=caretRegion(raw,pos);
    if(activeHost&&activeHost!==el)collapse(activeHost);
    activeHost=el._reveal?el:null;paintField(el,raw,context());
  }
  setCaret(el,pos);held={field,host:el,bounds:[pos,pos]};
  onInk?.(colorAt(raw,pos));
 }
 function replace(sel,text){
  if(!sel)return;
  const {el,raw,bounds:[a,b]}=sel;
  apply(el,raw.slice(0,a)+text+raw.slice(b),a+text.length,true,[a,b]);
 }
 function updateHistory(el,redo){
  const h=histories.get(el.dataset.field);if(!h)return;
  const from=redo?h.redo:h.undo,to=redo?h.undo:h.redo;
  if(!from.length)return;
  const old=from.pop(),raw=getRaw(el.dataset.field);
  to.push({raw,pos:rangeOf(el,raw)?.[0]??raw.length});apply(el,old.raw,Math.min(old.raw.length,old.pos),false);
 }
 function remember(){
  const el=document.activeElement;if(!el?.matches('[data-editor]'))return;
  const raw=getRaw(el.dataset.field),bounds=rangeOf(el,raw);
  if(bounds){target=el.dataset.field;held={field:target,host:el,bounds};onInk?.(colorAt(raw,bounds[0]));}
 }
 function exitRun(s,toEnd=false){
  if(!s)return;
  const v=leaveColor(s.raw,s.bounds[1],toEnd);apply(s.el,v.raw,v.at);
 }
 document.addEventListener('selectionchange',remember);
 document.addEventListener('focusin',e=>{
  const el=e.target;if(!el.matches('[data-editor]'))return;
  target=el.dataset.field;remember();
  if(el.isContentEditable&&pointerField!==el)requestAnimationFrame(()=>{
   if(document.activeElement!==el||composing||pointerField===el)return;
   const raw=getRaw(el.dataset.field),r=rangeOf(el,raw);if(r&&r[0]===r[1])reveal(el,raw,caretRegion(raw,r[0]),r[0]);
  });
 });
 document.addEventListener('focusout',e=>{
  if(e.target===activeHost&&!composing){remember();collapse(activeHost);}
 });
 document.addEventListener('pointerdown',e=>{
  pointerField=e.target.closest('.rich-edit,.paper-edit');
  if(e.target.closest('[data-preserve]')&&document.activeElement?.matches('[data-editor]'))remember();
  if(activeHost&&activeHost!==pointerField&&!composing){remember();collapse(activeHost);}
 },true);
 document.addEventListener('pointercancel',()=>{pointerField=null;});
 document.addEventListener('click',e=>{
  const el=e.target.closest('.rich-edit,.paper-edit');pointerField=null;
  if(!el||composing||document.activeElement!==el||el.closest('.stage.can-grab'))return;
  const raw=getRaw(el.dataset.field),selection=rangeOf(el,raw);
  if(selection&&selection[0]!==selection[1])return;
  const item=childOfField(el,e.target);
  if(item?.hasAttribute('data-local-source'))return;
  let pos=selection?.[0]??0,probe=pos;
  if(item?.hasAttribute('data-a')){
   const a=Number(item.dataset.a),b=Number(item.dataset.b);
   if(item.contentEditable==='false'){
    pos=Math.min(b-1,a+1);probe=a;
   }else probe=Math.max(a,Math.min(b-1,pos));
  }
  reveal(el,raw,syntaxRegion(raw,probe),pos);
 });
 document.addEventListener('contextmenu',e=>{
  const el=e.target.closest('.rich-edit,.paper-edit');if(!el||composing)return;
  const raw=getRaw(el.dataset.field);
  let pos=(rangeOf(el,raw)||[raw.length])[0];
  const point=document.caretPositionFromPoint?.(e.clientX,e.clientY);
  const range=!point?document.caretRangeFromPoint?.(e.clientX,e.clientY):null;
  const node=point?.offsetNode||range?.startContainer;
  if(node&&el.contains(node))pos=offsetAt(el,node,point?.offset??range.startOffset,raw);
  const code=colorAt(raw,pos);if(!code)return;
  e.preventDefault();target=el.dataset.field;setCaret(el,pos);held={field:target,host:el,bounds:[pos,pos]};
  showColorMenu?.(el,e,code);
 });
 document.addEventListener('compositionstart',e=>{
  const el=e.target.closest('.rich-edit, .paper-edit');if(!el)return;const raw=getRaw(el.dataset.field);
  composing={el,raw,bounds:rangeOf(el,raw)||[raw.length,raw.length]};
 });
 document.addEventListener('compositionend',e=>{
  if(!composing||composing.el!==e.target)return;
  const saved=composing;composing=null;suppress=saved.el;
  setTimeout(()=>{if(suppress===saved.el)suppress=null;},0);
  if(e.data)replace(saved,toSourceText(e.data));else{paintField(saved.el,saved.raw,context());setCaret(saved.el,saved.bounds[0]);}
 });
 document.addEventListener('beforeinput',e=>{
  const el=e.target.closest('.rich-edit, .paper-edit');if(!el||composing||e.isComposing)return;
  if(!e.cancelable)return;
  e.preventDefault();
  if(suppress===el && /Composition|insertText/.test(e.inputType))return;
  const raw=getRaw(el.dataset.field);
  let bounds=rangeOf(el,raw)||[raw.length,raw.length];
  const type=e.inputType;
  if(type==='historyUndo'||type==='historyRedo'){updateHistory(el,type==='historyRedo');return;}
  if(type.startsWith('delete')){
   if(bounds[0]===bounds[1]){
    const t=e.getTargetRanges?.()[0];
    if(t&&!t.collapsed)bounds=[offsetAt(el,t.startContainer,t.startOffset,raw),offsetAt(el,t.endContainer,t.endOffset,raw,true)];
    if(bounds[0]===bounds[1]){
      const pos=bounds[0],back=!type.includes('Forward'),local=el._reveal;
      if(local&&(back?pos>local.from&&pos<=local.to:pos>=local.from&&pos<local.to)){
        const part=back?raw.slice(local.from,pos):raw.slice(pos,local.to);
        const units=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(part)].map(s=>s.segment):Array.from(part);
        const length=(back?units.at(-1):units[0])?.length||0;
        bounds=back?[pos-length,pos]:[pos,pos+length];
      }else bounds=deleteSpan(raw,pos,back);
    }
   }
   replace({el,raw,bounds},'');return;
  }
  if(type==='insertParagraph'||type==='insertLineBreak'){replace({el,raw,bounds},'\\n');return;}
  if(type==='insertText'||type==='insertReplacementText'){replace({el,raw,bounds},toSourceText(e.data??e.dataTransfer?.getData('text/plain')??''));}
 });
 document.addEventListener('input',e=>{
  const el=e.target.closest('.rich-edit, .paper-edit');if(!el||composing||e.isComposing||suppress===el)return;
  // Native non-cancellable input (spellcheck or mobile keyboards). Keep source outside the changed visible span.
  const raw=getRaw(el.dataset.field), box=document.createElement('div');box._reveal=el._reveal;paintField(box,raw,context());
  const visible=n=>[...n.childNodes].map(x=>x.nodeName==='BR'?'\n':x.nodeType===1&&x.dataset.tail?'':x.textContent).join('');
  const old=visible(box),now=visible(el);
  if(old===now)return;
  let p=0,q=0;while(p<old.length&&p<now.length&&old[p]===now[p])p++;
  while(q<old.length-p&&q<now.length-p&&old[old.length-1-q]===now[now.length-1-q])q++;
  const idx=(offset,end)=>{let v=0;for(const n of box.children){const len=n.tagName==='BR'?1:n.textContent.length;if(offset<v+len||offset===v+len&&end)return n.dataset.k==='text'?Number(n.dataset.a)+offset-v:offset===v?Number(n.dataset.a):Number(n.dataset.b);v+=len;}return raw.length;};
  replace({el,raw,bounds:[idx(p,false),idx(old.length-q,true)]},toSourceText(now.slice(p,now.length-q)));
 });
 document.addEventListener('paste',e=>{
  const el=e.target.closest('.rich-edit, .paper-edit');if(!el)return;e.preventDefault();
  const raw=getRaw(el.dataset.field);replace({el,raw,bounds:rangeOf(el,raw)||[raw.length,raw.length]},toSourceText(e.clipboardData.getData('text/plain')));
 });
 document.addEventListener('keydown',e=>{
  const el=e.target.closest('.rich-edit, .paper-edit');if(!el||e.isComposing)return;
  if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();updateHistory(el,e.shiftKey||e.key.toLowerCase()==='y');}
  if(!e.shiftKey&&!e.altKey&&!e.ctrlKey&&!e.metaKey && (e.key==='ArrowRight'||e.key==='Escape')){
    const raw=getRaw(el.dataset.field),bounds=rangeOf(el,raw);
    if(!bounds||bounds[0]!==bounds[1]||!colorAt(raw,bounds[0]))return;
    if(e.key==='Escape'||raw.startsWith('§!',bounds[0])||bounds[0]===raw.length){
      e.preventDefault();e.stopImmediatePropagation();exitRun({el,raw,bounds},e.key==='Escape');
    }
  }
 });
 document.addEventListener('keyup',e=>{
  const el=e.target.closest('.rich-edit,.paper-edit');if(!el||composing||e.isComposing||e.shiftKey||!['ArrowLeft','ArrowRight','Home','End','ArrowUp','ArrowDown'].includes(e.key))return;
  const raw=getRaw(el.dataset.field),r=rangeOf(el,raw);if(!r||r[0]!==r[1])return;
  if(el._reveal&&r[0]>el._reveal.from&&r[0]<el._reveal.to)return;
  reveal(el,raw,caretRegion(raw,r[0]),r[0]);
 });
 for(const action of ['copy','cut'])document.addEventListener(action,e=>{
  const focused=document.activeElement;
  if(focused?.matches('textarea,input')&&!(getSelection()?.toString()))return;
  const sel=getSelection();if(!sel?.rangeCount||sel.isCollapsed)return;
  const r=sel.getRangeAt(0);
  const fields=[...document.querySelectorAll('[data-encoded]')].filter(el=>r.intersectsNode(el));
  if(!fields.length||!fields.some(el=>el.contains(r.startContainer)||el.contains(r.endContainer)))return;
  if(action==='cut'&&(fields.length!==1||!fields[0].isContentEditable))return;
  const chunks=fields.map(el=>{
   const raw=getRaw(el.dataset.field);
   const a=el.contains(r.startContainer)?offsetAt(el,r.startContainer,r.startOffset,raw):0;
   const b=el.contains(r.endContainer)?offsetAt(el,r.endContainer,r.endOffset,raw,true):raw.length;
   const full=[...el.children].filter(n=>!n.dataset.tail);
   const allVisible=full.length&&a<=Number(full[0].dataset.a)&&b>=Number(full.at(-1).dataset.b);
   return {el,raw,bounds:[a,b],text:allVisible?raw:copyPart(raw,a,b)};
  });
  e.preventDefault();e.clipboardData.setData('text/plain',chunks.map(x=>x.text).join('\\n\\n'));
  if(action==='cut')replace(chunks[0],'');
 });
 return {
  remember, reset(){collapse(activeHost);activeHost=null;target='desc';held=null;histories.clear();composing=null;onInk?.('');},
  insert(text){replace(current(),text);},
  exitColor(toEnd=false){exitRun(current(),toEnd);},
  color(code){const s=current();if(!s)return;if(!code&&s.bounds[0]===s.bounds[1]){exitRun(s);return;}const v=applyColor(s.raw,s.bounds[0],s.bounds[1],code);apply(s.el,v.raw,v.at);},
  focus(field){const el=editor(field);if(el){target=field;setCaret(el,getRaw(field).length);}}
 };
}
