import {COLORS,EVENT_INK,VIC_INK,useModColors,toSourceText,TYPE_NAMES,displayText,localisationEntries,localisationIssue,idError,nextSuffix} from './engine.mjs';
import {STORE,uid,readWorkspace} from './store.mjs';
import {icon,esc} from './icons.mjs';
import {paintField,richController} from './rich.mjs';
import {makeDialogs} from './dialogs.mjs';
import {parseOption,optionVisibility,tagPattern} from './options.mjs';
import {setupCanvas} from './canvas.mjs';
import {selectedFiles,fileBlob,downloadBlob} from './game-files.mjs';

const $=s=>document.querySelector(s), all=s=>Array.from(document.querySelectorAll(s));
const state=readWorkspace();
let mode='rich',folderOpen=true,zoom=1,storageOK=true,popAnchor=null;
const drafts=new Map();
const selection=new Set();
let selecting=false;
const idIssue=doc=>idError(drafts.get(doc.uid)??doc.id,state.docs,doc.uid);
const getDoc=()=>state.docs.find(d=>d.uid===state.active);
const fieldRaw=(d,f)=>f==='title'?d.title:f==='desc'?d.desc:(d.options.find(o=>o.key===f.slice(4))?.text||'');
const context=()=>({values:getDoc()?.values||{},entries:localisationEntries(state.docs),colors:{...(state.font==='vic_18_black'?VIC_INK:state.font==='generic'?{}:EVENT_INK),...state.modColors}});
const hydrate=(root=document)=>root.querySelectorAll('i[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon,Number(el.dataset.size)||18);});
const btn=(act,label,ico,cls='icon-button',more='')=>'<button type="button" class="'+cls+'" data-action="'+act+'" title="'+esc(label)+'" aria-label="'+esc(label)+'" '+more+'>'+icon(ico,16)+'</button>';
const label=(name,field,key)=>'<div class="field-line"><label class="field-label" for="'+field+'">'+name+'</label><span class="field-key" title="本地化键">'+esc(key)+'</span></div>';
const checkPicture=s=>/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
function toast(msg){const el=$('#toast');el.textContent=msg;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{el.hidden=true;},2600);}
function save(){
 try{localStorage.setItem(STORE,JSON.stringify(state));storageOK=true;}catch{storageOK=false;}
 const el=$('#save-state');el.classList.toggle('failed',!storageOK);el.lastElementChild.textContent=storageOK?'已保存到本地':'未能保存';el.title=storageOK?'保存在当前浏览器，可从「工作区备份」导出。':'浏览器存储不可用或已满，请导出工作区备份。';
}
function updateBatch(){
 const count=selection.size,total=state.docs.length,check=$('#select-all-events');
 $('#batch-toggle').disabled=!total;$('#batch-toggle').setAttribute('aria-pressed',String(selecting));
 $('#batch-toggle span').textContent=selecting?'取消选择':'批量下载';$('#batch-panel').hidden=!selecting;
 check.checked=!!total&&count===total;check.indeterminate=count>0&&count<total;
 $('#selection-count').textContent='已选 '+count+' / '+total;$('#download-selection').disabled=!count;
}
function drawNav(){
 const d=getDoc();$('#file-count').textContent=state.docs.length;
 const existing=new Set(state.docs.map(doc=>doc.uid));
 for(const id of selection)if(!existing.has(id))selection.delete(id);
 if(!existing.size)selecting=false;
 updateBatch();
 $('#filelist').hidden=!folderOpen;$('.folder-row').setAttribute('aria-expanded',String(folderOpen));
 const workspaceContext=context();
 $('#filelist').innerHTML=state.docs.map(doc=>{
  const title=displayText(doc.title,{...workspaceContext,values:doc.values})||'未命名事件';
  const name='<span class="file-text"><strong>'+esc(doc.id)+'</strong><small>'+esc(title)+'</small></span>';
  const uidAttr='data-uid="'+esc(doc.uid)+'"';
  if(selecting)return '<label class="file-item selectable-file"><input type="checkbox" class="select-event" '+uidAttr+' aria-label="选择 '+esc(doc.id)+'" '+(selection.has(doc.uid)?'checked':'')+'>'+name+'</label>';
  const actions=btn('file-download','下载 '+doc.id+' 的 TXT 和 YML','download','icon-button file-more file-download','aria-haspopup="dialog" '+uidAttr)+btn('file-menu','事件操作','more','icon-button file-more','aria-haspopup="menu" '+uidAttr);
  return '<div class="file-item '+(doc===d?'active':'')+'"><button class="file-main" data-action="open" '+uidAttr+' title="'+esc(doc.id+' · '+title)+'" '+(doc===d?'aria-current="page"':'')+'>'+icon(doc.kind==='news_event'?'newspaper':'file',18)+name+'</button><div class="file-actions">'+actions+'</div></div>';
 }).join('');
 $('#tabs').innerHTML=state.tabs.map(id=>{
  const t=state.docs.find(x=>x.uid===id);if(!t)return '';
  return '<div class="tab-cell '+(t===d?'on':'')+'"><button role="tab" aria-selected="'+(t===d)+'" class="tab-select" data-action="open" data-uid="'+esc(t.uid)+'">'+icon(t.kind==='news_event'?'newspaper':'file',14)+esc(t.id)+'</button>'+btn('close-tab','关闭 '+t.id+' 标签','close','icon-button','data-uid="'+esc(t.uid)+'"')+'</div>';
 }).join('');
 $('#status-file').textContent=d?d.id:'尚未打开事件';
}
function drawEdField(field,fieldId,classes,aria,placeholder){
 const d=getDoc(),raw=fieldRaw(d,field);
 const attrs=' id="'+fieldId+'" data-field="'+esc(field)+'" data-editor="true" aria-label="'+esc(aria)+'" spellcheck="false"';
 if(mode==='source')return '<textarea'+attrs+' class="raw-field '+classes+'" rows="1" placeholder="'+esc(placeholder)+'">'+esc(raw)+'</textarea>';
 return '<div'+attrs+' class="rich-edit '+classes+'" contenteditable="true" role="textbox" aria-multiline="true" data-encoded="true" data-placeholder="'+esc(placeholder)+'"></div>';
}
function toolbar(){
 const swatches=['Y','R','G','C'].map(k=>'<button class="swatch-button" data-preserve data-action="ink" data-code="'+k+'" aria-label="'+COLORS[k][0]+' §'+k+'" title="'+COLORS[k][0]+' §'+k+'"><span style="background:'+(context().colors[k]||COLORS[k][1])+'"></span></button>').join('');
 return '<div class="toolbar" role="toolbar" aria-label="文本格式"><button class="toolpick" data-action="palette" data-preserve aria-haspopup="menu" title="选择文字颜色" aria-label="选择文字颜色"><span class="color-letter">A</span>'+icon('chevron',12)+'</button><span class="tool-separator"></span>'+swatches+'<button class="end-ink" data-action="end-ink" data-preserve title="结束当前颜色，继续用默认色输入。色段末尾也可按 →。">结束颜色</button><span class="tool-separator"></span>'+btn('newline','插入换行','enter','tool-plain','data-preserve')+'<button class="syntax-button" data-action="syntax" data-preserve aria-haspopup="menu">'+icon('braces',15)+'插入语法'+icon('chevron',11)+'</button></div>';
}
function drawEditor(){
 const d=getDoc();if(!d)return;
 const id=drafts.get(d.uid)??d.id, err=idError(id,state.docs,d.uid);
 $('#editor').innerHTML='<div class="meta-fields"><div><label for="event-id">事件 ID</label><input id="event-id" class="'+(err?'invalid':'')+'" spellcheck="false" autocomplete="off" value="'+esc(id)+'" aria-describedby="id-error"></div><div><label for="event-type">事件类型</label><div class="select-wrap"><select id="event-type">'+Object.entries(TYPE_NAMES).map(([k,n])=>'<option value="'+k+'" '+(d.kind===k?'selected':'')+'>'+n+'</option>').join('')+'</select>'+icon('chevron',13)+'</div></div></div><div class="id-error" id="id-error" role="status" '+(!err?'hidden':'')+'>'+esc(err)+'</div>'+
 '<label class="major-setting" title="major = yes"><input type="checkbox" id="event-major" '+(d.major?'checked':'')+'>向所有国家广播 <code>major</code></label>'+
 '<section class="form-block">'+label('标题','field-title',d.id+'.t')+drawEdField('title','field-title','title-field','事件标题','输入事件标题')+'</section>'+
 '<section class="form-block">'+label('正文','field-desc',d.id+'.d')+'<div class="body-editor">'+toolbar()+drawEdField('desc','field-desc','body-field','事件正文',mode==='rich'?'在这里撰写事件正文…':'输入 HOI4 本地化原文…')+'</div></section>'+
 '<section class="form-block"><div class="options-top"><span class="field-label">事件选项</span><span class="option-count">'+d.options.length+'</span></div>'+
 d.options.map(o=>'<div class="option-row"><label class="option-code" for="field-opt-'+o.key+'" title="'+esc(d.id+'.'+o.key)+'">'+o.key+'</label>'+drawEdField('opt:'+o.key,'field-opt-'+o.key,'opt-field','选项 '+o.key,'输入选项文字')+btn('option-menu','选项 '+o.key+' 设置','more','icon-button opt-menu','data-key="'+o.key+'" aria-haspopup="menu"')+'</div>').join('')+'<button class="add-option" data-action="add-option">'+icon('plus',14)+'添加选项</button></section><div id="loc-warning" class="field-error" role="status" hidden></div>';
 if(mode==='rich'){const ctx=context();all('#editor .rich-edit').forEach(el=>paintField(el,fieldRaw(d,el.dataset.field),ctx));}
 for(const el of all('#mode-switch button')){const on=el.dataset.action===mode;el.classList.toggle('selected',on);el.setAttribute('aria-pressed',String(on));}
 showLocalisationIssue();
}
function showLocalisationIssue(){
 const box=$('#loc-warning'),d=getDoc();if(!box||!d)return;
 const fields=[['标题',d.title],['正文',d.desc],...d.options.map(o=>['选项 '+o.key,o.text])];
 const bad=fields.map(([label,raw])=>[label,localisationIssue(raw)]).find(row=>row[1]);
 box.hidden=!bad;box.textContent=bad?bad.join(' · '):'';
}
function paintPreviewFields(d,except=null){
 const ctx=context();all('#paper [data-field]').forEach(el=>{
  if(el===except)return;
  const raw=fieldRaw(d,el.dataset.field);
  el.classList.toggle('paper-placeholder',!raw);
  el.dataset.placeholder=el.dataset.field==='title'?'事件标题':el.dataset.field==='desc'?'事件正文':'选项文字';
  if(mode==='rich'){
   el.classList.add('paper-edit');el.contentEditable='true';el.dataset.editor='preview';el.spellcheck=false;el.title='点击直接编辑，选中后可复制 HOI4 原文';
   el.setAttribute('aria-label','预览 · '+(el.dataset.field==='title'?'事件标题':el.dataset.field==='desc'?'事件正文':'选项 '+el.dataset.field.slice(4)));
  }
  paintField(el,raw,ctx);
 });
}
function drawPreview(){
 const d=getDoc();if(!d)return;
 const paper=$('#paper'),news=d.kind==='news_event';
 const photo=d.art==='rhine'?'assets/rhine.webp':checkPicture(d.art)?d.art:'';
 const scripts=d.options.map(o=>parseOption(o.extra)),view={tag:state.previewTag,major:d.major,original:state.originalRecipient};
 const decisions=scripts.map(s=>optionVisibility(s,view));
 const shown=d.options.filter((_,i)=>decisions[i]===true),pending=d.options.filter((_,i)=>decisions[i]===null);
 $('#recipient-tag').value=view.tag;$('#original-recipient').checked=view.original;
 $('.original-choice').hidden=!(d.major&&scripts.some(s=>s.nodes.some(n=>n.key.toLowerCase()==='original_recipient_only')));
 paper.className='event-paper '+(news?'news':'country');
 const img=photo?'<img class="'+(news?'news-photo':'')+'" src="'+esc(photo)+'" alt="'+(d.art==='rhine'?'预览插图：科隆大教堂与莱茵河岸':'自定义事件插图')+'">':'';
 paper.innerHTML=(news?'<div class="news-mast" aria-label="World News">'+icon('globe',30)+'<span class="world">World News</span>'+icon('globe',30)+'</div>'+img:img?'<div class="country-photo">'+img+'</div>':'')+
 '<h3 class="paper-title paper-copy" data-encoded data-field="title"></h3><div class="paper-body paper-copy" data-encoded data-field="desc"></div><div class="paper-options">'+shown.map(o=>'<div class="game-option paper-copy" data-encoded data-field="opt:'+o.key+'"></div>').join('')+'</div>';
 paintPreviewFields(d);
 $('#paper-meta').innerHTML=icon(news?'newspaper':'file',13)+'<span>'+d.kind+'</span><i class="pip"></i><span>'+esc(d.id)+'</span>';
 const note=$('#preview-note');note.hidden=!!shown.length&&!pending.length;
 note.textContent=pending.length?'选项 '+pending.map(o=>o.key).join('、')+' 需游戏状态或脚本校验。':!shown.length?'当前接收国没有符合条件的选项。':'';
}
function resizePaper(){
 const stage=$('#stage');if(!stage.clientWidth)return;
 const pad=window.innerWidth<=720?34:window.innerWidth<=1120?40:58;
 $('#paper-space').style.setProperty('--sheet-width',Math.max(220,Math.min(stage.clientWidth-pad,546))+'px');
 $('#paper-space').style.setProperty('--sheet-zoom',String(zoom));
}
function refresh({reset=false}={}){
 useModColors(state.modColors);const open=!!getDoc();$('#panes').hidden=!open;$('#empty-workspace').hidden=open;$('.mobile-switch').hidden=!open;
 if(reset){rich.reset();$('#edit-scroll').scrollTop=0;canvas.reset();}
 drawNav();if(open){drawEditor();drawPreview();requestAnimationFrame(resizePaper);}
}
function persistDraw(reset=false){save();refresh({reset});}
function updateField(field,value,origin=null){
 const d=getDoc();if(!d)return;
 if(field==='title'||field==='desc')d[field]=value;else{const o=d.options.find(x=>x.key===field.slice(4));if(!o)return;o.text=value;}
 save();
 showLocalisationIssue();
 if(origin?.closest('#paper')){
  origin.classList.toggle('paper-placeholder',!value);paintPreviewFields(d,origin);
  const editorEl=all('#editor [data-editor]').find(el=>el.dataset.field===field);
  if(editorEl){if(editorEl.tagName==='TEXTAREA')editorEl.value=value;else paintField(editorEl,value,context());}
 }else drawPreview();
 if(field==='title')drawNav();
}
const rich=richController({
 getRaw:f=>getDoc()?fieldRaw(getDoc(),f):'',setRaw:updateField,context,
 onInk(code){
   const end=$('.end-ink');if(end){end.dataset.active=String(!!code);end.title=code?'结束 §'+code+'，继续用默认色输入':'在光标处结束颜色';}
   const letter=$('.color-letter');if(letter)letter.style.borderBottomColor=code?(context().colors[code]||COLORS[code]?.[1]):'';
 },
 showColorMenu(el,e,code){
   const html='<div class="popover-label">'+esc(COLORS[code][0])+' · §'+esc(code)+'</div>'+menu('end-ink','在此结束颜色','palette','data-preserve','§!')+menu('exit-run','跳到色段末尾','right','data-preserve','Esc');
   openPop(el,html,{left:e.clientX,top:e.clientY,bottom:e.clientY});
 }
});
const canvas=setupCanvas({stage:$('#stage'),surface:$('#paper-space'),hand:$('#pan-toggle'),resetView:$('#reset-view'),
 resetZoom(){zoom=1;$('#zoom').value='1';resizePaper();}});
function openDoc(id){
 if(!state.docs.some(x=>x.uid===id))return;
 if(!state.tabs.includes(id))state.tabs.push(id);state.active=id;document.body.classList.remove('files-open');
 persistDraw(true);$('.tab-cell.on')?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function closeTab(id){
 const i=state.tabs.indexOf(id);if(i<0)return;state.tabs.splice(i,1);
 if(state.active===id)state.active=state.tabs[Math.min(i,state.tabs.length-1)]||null;
 if(!state.active)document.body.classList.remove('expanded');
 persistDraw(true);
}
function hidePop(){
 const pop=$('#popover');if(pop.hidden)return;
 const urls=[...pop.querySelectorAll('a[download]')].map(link=>link.href);
 if(urls.length)setTimeout(()=>urls.forEach(url=>URL.revokeObjectURL(url)),30000);
 pop.hidden=true;pop.replaceChildren();pop.removeAttribute('aria-label');popAnchor?.setAttribute('aria-expanded','false');popAnchor=null;
}
function openPop(anchor,html,point=null){
 const pop=$('#popover');if(!point&&!pop.hidden&&popAnchor===anchor){hidePop();return;}
 hidePop();popAnchor=anchor;anchor.setAttribute('aria-expanded','true');pop.innerHTML=html;pop.hidden=false;pop.setAttribute('role','menu');
 const r=point||anchor.getBoundingClientRect(),size=pop.getBoundingClientRect();
 pop.style.left=Math.max(6,Math.min(r.left,document.documentElement.clientWidth-size.width-7))+'px';
 pop.style.top=(r.bottom+size.height+8<innerHeight?r.bottom+5:Math.max(6,r.top-size.height-5))+'px';
}
const menu=(act,title,ico,attrs='',trail='')=>'<button class="menuitem" role="menuitem" data-action="'+act+'" '+attrs+'>'+icon(ico,15)+esc(title)+(trail?'<code>'+esc(trail)+'</code>':'')+'</button>';
function downloadEvents(anchor,docs,separate=false,format='both'){
 if(!docs.length||!anchor)return;
 const files=selectedFiles(docs,separate,state.docs,idIssue).filter(f=>format==='both'||f.kind===format);
 if(files.length===1&&!files[0].issues.length){
  downloadBlob(files[0].name,fileBlob(files[0]));return;
 }
 const ready=files.every(f=>!f.issues.length);
 const rows=files.map((f,i)=>{
  const kind=f.kind==='script'?'TXT':'YML',label='<b>'+kind+'</b><span>'+esc(f.name)+'</span>';
  if(f.issues.length)return '<div class="download-unavailable">'+label+'</div><div class="download-error">'+f.issues.map(esc).join('<br>')+'</div>';
  return '<a class="download-link" data-index="'+i+'" download="'+esc(f.name)+'" title="'+esc(f.path)+'">'+label+icon('download',15)+'</a>';
 }).join('');
 const heading=ready?'已请求下载 '+files.length+' 个文件':'请检查导出内容';
 openPop(anchor,'<div class="download-sheet"><div class="download-heading">'+esc(heading)+'</div><div class="download-links">'+rows+'</div><p>'+(ready?'也可以点击文件名单独下载。':'可用的文件可单独下载。')+'</p></div>');
 const pop=$('#popover');pop.setAttribute('role','dialog');pop.setAttribute('aria-label','游戏文件下载');
 const links=pop.querySelectorAll('.download-link');
 for(const link of links)link.href=URL.createObjectURL(fileBlob(files[Number(link.dataset.index)]));
 if(ready)for(const link of links)link.click();
 links[0]?.focus({preventScroll:true});
}
function phonePreview(on){document.body.classList.toggle('phone-preview',on);all('.mobile-switch button').forEach(b=>b.classList.toggle('chosen',b.dataset.action===(on?'showpreview':'showedit')));requestAnimationFrame(resizePaper);}
const dialogs=makeDialogs({state,getDoc,idIssue,save,refresh,openDoc,closeTab,toast,rich,resetDrafts:()=>drafts.clear()});
function click(e){
 const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,d=getDoc(),key=b.dataset.key,id=b.dataset.uid;
 if(!['file-menu','option-menu','palette','syntax'].includes(a))hidePop();
 if(dialogs.handle(a,b))return;
 if(a==='files'){document.body.classList.toggle('files-open');return;}
 if(a==='folder'){folderOpen=!folderOpen;drawNav();return;}
 if(a==='batch-toggle'){selecting=!selecting;selection.clear();if(selecting)folderOpen=true;drawNav();return;}
 if(a==='download-selection'){downloadEvents(b,state.docs.filter(doc=>selection.has(doc.uid)),$('#batch-layout').value==='separate');return;}
 if(a==='file-download'||a==='download-format'){
  const doc=state.docs.find(item=>item.uid===id);
  const anchor=a==='file-download'?b:all('.file-download').find(el=>el.dataset.uid===id);
  if(doc)downloadEvents(anchor,[doc],false,b.dataset.format||'both');return;
 }
 if(a==='open'){openDoc(id);return;}if(a==='close-tab'){closeTab(id);return;}
 if(a==='file-menu'){const attr='data-uid="'+esc(id)+'"';openPop(b,menu('open','打开事件','file',attr)+menu('download-format','下载事件脚本','download',attr+' data-format="script"','.txt')+menu('download-format','下载中文本地化','download',attr+' data-format="loc"','.yml')+menu('duplicate','复制一份事件','copy',attr)+menu('delete-file','删除事件','trash',attr));return;}
 if(!d)return;
 switch(a){
 case 'rich':case 'source':if(mode!==a){rich.reset();mode=a;drawEditor();drawPreview();}break;
 case 'showedit':phonePreview(false);break;
 case 'showpreview':phonePreview(true);break;
 case 'expand':{const on=document.body.classList.toggle('expanded');b.innerHTML=icon(on?'compress':'expand',16);b.title=on?'恢复分栏':'展开预览';b.setAttribute('aria-label',b.title);requestAnimationFrame(resizePaper);break;}
 case 'add-option':{const k=nextSuffix(d.options);d.options.push({key:k,text:'',extra:''});persistDraw();rich.focus('opt:'+k);$('#field-opt-'+k).scrollIntoView({block:'nearest'});break;}
 case 'option-menu':{const i=d.options.findIndex(o=>o.key===key),attr='data-key="'+key+'"';openPop(b,menu('option-up','上移','up',attr+(i===0?' disabled':''))+menu('option-down','下移','chevron',attr+(i===d.options.length-1?' disabled':''))+menu('option-code','选项脚本','braces',attr)+menu('delete-option','删除选项','trash',attr+(d.options.length===1?' disabled':'')));break;}
 case 'option-up':case 'option-down':{const i=d.options.findIndex(o=>o.key===key),to=i+(a==='option-up'?-1:1);if(to<0||to>=d.options.length)return;[d.options[i],d.options[to]]=[d.options[to],d.options[i]];persistDraw();break;}
 case 'palette':openPop(b,'<div class="popover-label">文字颜色</div><div class="palette-grid">'+Object.entries(COLORS).sort(([k],[l])=>(/\d/.test(k)?1:0)-(/\d/.test(l)?1:0)).map(([k,[n,h]])=>'<button data-action="ink" data-code="'+k+'" title="'+n+' §'+k+'" aria-label="'+n+' §'+k+'"><i class="palette-dot" style="background:'+h+'"></i>§'+k+'</button>').join('')+'</div><div class="palette-footer">'+menu('ink','清除颜色','palette','data-code=""','§!')+'</div>');break;
 case 'ink':rich.color(b.dataset.code);break;
 case 'end-ink':rich.exitColor();break;
 case 'exit-run':rich.exitColor(true);break;
 case 'newline':rich.insert('\\n');break;
 case 'syntax':openPop(b,menu('insert','国家名称','flag','data-value="[ROOT.GetName]"','[ROOT.GetName]')+menu('insert','数值变量','braces','data-value="[?my_var|0]"','[?my_var|0]')+menu('insert','本地化引用','code','data-value="$loc_key$"','$loc_key$')+menu('insert','政治点数图标','landmark','data-value="£pol_power"','£pol_power')+menu('insert','国家旗帜','flag','data-value="@FRA"','@FRA')+'<div class="palette-footer">'+menu('settings','设置变量预览值','settings')+'</div>');break;
 case 'insert':rich.insert(b.dataset.value);break;
 }
}
document.addEventListener('click',click);
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#popover')&&!e.target.closest('[aria-haspopup]'))hidePop();},true);
document.addEventListener('input',e=>{
 if(e.target.id==='recipient-tag'){
  const tag=e.target.value.toUpperCase();e.target.value=tag;
  if(tagPattern.test(tag)){state.previewTag=tag;drawPreview();save();}
  return;
 }
 if(e.target.matches('textarea[data-editor]')){
  const el=e.target,entered=el.value,raw=toSourceText(entered);
  if(entered!==raw&&!e.isComposing){
   const a=toSourceText(entered.slice(0,el.selectionStart)).length,b=toSourceText(entered.slice(0,el.selectionEnd)).length;
   el.value=raw;el.setSelectionRange(a,b);
  }
  updateField(el.dataset.field,raw);return;
 }
 if(e.target.id!=='event-id')return;
 const d=getDoc(),val=e.target.value,issue=idError(val,state.docs,d.uid);e.target.classList.toggle('invalid',!!issue);
 const info=$('#id-error');info.textContent=issue;info.hidden=!issue;
 if(issue){drafts.set(d.uid,val);return;}
 drafts.delete(d.uid);d.id=val;save();drawNav();drawPreview();all('#editor .field-key').forEach((el,i)=>el.textContent=val+(i?'.d':'.t'));
 for(const el of all('.option-code'))el.title=val+'.'+el.textContent;
});
document.addEventListener('change',e=>{
 if(e.target.classList.contains('select-event')){
  const id=e.target.dataset.uid;if(e.target.checked)selection.add(id);else selection.delete(id);
  updateBatch();return;
 }
 if(e.target.id==='select-all-events'){
  selection.clear();if(e.target.checked)for(const doc of state.docs)selection.add(doc.uid);
  all('.select-event').forEach(el=>{el.checked=selection.has(el.dataset.uid);});updateBatch();return;
 }
 if(e.target.id==='event-type'){getDoc().kind=e.target.value;save();drawPreview();drawNav();}
 if(e.target.id==='event-major'){getDoc().major=e.target.checked;save();drawPreview();}
 if(e.target.id==='original-recipient'){state.originalRecipient=e.target.checked;save();drawPreview();}
 if(e.target.id==='recipient-tag'&&!tagPattern.test(e.target.value)){e.target.value=state.previewTag;toast('请输入三位国家标签，例如 FRA 或 D01。');}
 if(e.target.id==='zoom'){zoom=Number(e.target.value);resizePaper();}
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!$('#modal').open){
   if(!$('#popover').hidden){const b=popAnchor;hidePop();b?.focus();return;}
   if(document.body.classList.contains('expanded')){$('#expand').click();return;}
   if(document.body.classList.contains('files-open')){document.body.classList.remove('files-open');return;}
   if(e.target.id==='event-id'){drafts.delete(getDoc().uid);drawEditor();}
 }
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&!$('#modal').open){e.preventDefault();save();toast(storageOK?'工作区已保存':'请导出工作区备份');}
 if(e.altKey&&e.key.toLowerCase()==='n'&&!$('#modal').open){e.preventDefault();dialogs.handle('new',{});}
});
window.addEventListener('resize',()=>{hidePop();resizePaper();});
new ResizeObserver(resizePaper).observe($('#stage'));
hydrate();refresh();save();
