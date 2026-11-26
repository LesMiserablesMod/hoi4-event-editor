import {COLORS,readModColors,writeModColors,TYPE_NAMES,idError,identityKey,namespaceOf,scan} from './engine.mjs';
import {makeDoc,uid,validWorkspace,upgradeWorkspace} from './store.mjs';
import {parseOption} from './options.mjs';
import {gameFile,eventFileBase,fileBlob,downloadBlob} from './game-files.mjs';
import {icon,esc} from './icons.mjs';
const $=s=>document.querySelector(s);
const typeChoices=on=>Object.entries(TYPE_NAMES).map(([key,name])=>'<option value="'+key+'" '+(key===on?'selected':'')+'>'+name+'</option>').join('');
const pick=(id,content)=>'<div class="select-wrap"><select id="'+id+'">'+content+'</select>'+icon('chevron',13)+'</div>';
const action=(key,label,style='outline',glyph='',attrs='')=>'<button type="button" class="'+style+'" data-action="'+key+'" '+attrs+'>'+(glyph?icon(glyph,15):'')+esc(label)+'</button>';
const chip=(key,label,chosen)=>action(key,label,'chip','','aria-pressed="'+chosen+'"');
const links='<div class="manual-links"><a href="https://hoi4.paradoxwikis.com/Localisation" target="_blank" rel="noreferrer">Wiki · 本地化 '+icon('external',12)+'</a><a href="https://hoi4.paradoxwikis.com/Event_modding" target="_blank" rel="noreferrer">Wiki · 事件 '+icon('external',12)+'</a><a href="https://cooderatom.github.io/hoi4-zh-wiki/Localisation.html" target="_blank" rel="noreferrer">Wiki 镜像 '+icon('external',12)+'</a></div>';
async function clipboard(code){
 if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(code);return true;}catch{}}
 const box=$('#export-code');box.focus();box.select();
 try{return document.execCommand('copy');}catch{return false;}
}
function isoDate(){const t=new Date();return [t.getFullYear(),String(t.getMonth()+1).padStart(2,'0'),String(t.getDate()).padStart(2,'0')].join('-');}
function previewTokens(d){
 const keys=new Set(Object.keys(d.values));
 for(const txt of [d.title,d.desc,...d.options.map(o=>o.text)])for(const t of scan(txt)){
  if(['scope','variable','reference'].includes(t.kind)){const marker=t.value.slice(1,-1).split('|')[0];keys.add(t.value[0]+marker+t.value.at(-1));}
 }
 return [...keys];
}
async function resizeImage(file){
 if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error('请选择 PNG、JPEG 或 WebP 图片。');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=url;await img.decode();
  const scale=Math.min(1,1000/img.naturalWidth,680/img.naturalHeight),c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=c.getContext('2d');ctx.fillStyle='#ede6d0';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',.8);
 }finally{URL.revokeObjectURL(url);}
}
export function makeDialogs({state,getDoc,idIssue,save,refresh,openDoc,closeTab,toast,resetDrafts}){
 const dialog=$('#modal');
 let section='',manualTab='text',exportKind='loc',whole=false,subject=null,extraKey='',restored=null,settingsDraft=null,settingsToken=0;
 const content=$('#modal-content');
 function dialogBox(name,title,body,{wide=false,glyph='file',focus=null}={}){
  section=name;dialog.classList.toggle('wide',wide);
  content.innerHTML='<div class="dialog-head">'+icon(glyph,21)+'<h2 id="dialog-title">'+esc(title)+'</h2><button class="icon-button" data-action="dismiss" title="关闭" aria-label="关闭对话框">'+icon('close',17)+'</button></div><div class="dialog-body">'+body+'</div>';
  dialog.setAttribute('aria-labelledby','dialog-title');if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
  if(focus)$(focus)?.focus();else content.querySelector('.dialog-head button')?.focus({preventScroll:true});
 }
 function dismiss(){dialog.close();}
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dismiss();});
 dialog.addEventListener('close',()=>{section='';restored=null;settingsToken++;});
 function nextId(ns){const used=new Set(state.docs.map(d=>identityKey(d.id)));let n=1;while(used.has(ns+'.'+n))n++;return ns+'.'+n;}
 function newDialog(copy){
  subject=copy||null;const cur=copy||getDoc(),id=nextId(cur?namespaceOf(cur.id):'event');
  dialogBox('new',copy?'复制一份事件':'新建事件','<form id="new-form" class="new-fields" novalidate><label for="new-id">事件 ID</label><input id="new-id" autocomplete="off" spellcheck="false" class="mono" value="'+esc(id)+'"><p class="hint">命名空间与数字编号，例如 france.1。</p><label for="new-title">事件标题</label><input id="new-title" placeholder="输入标题" value="'+esc(copy?copy.title:'')+'"><label for="new-kind">事件类型</label>'+pick('new-kind',typeChoices(copy?.kind||'country_event'))+'<div id="new-error" class="field-error" role="status"></div><div class="dialog-actions">'+action('dismiss','取消')+'<button class="primary" type="submit">'+icon('plus',15)+'创建事件</button></div></form>',{glyph:copy?'copy':'file',focus:'#new-title'});
  $('#new-form').addEventListener('submit',e=>{
    e.preventDefault();const id=$('#new-id').value.trim(),issue=idError(id,state.docs,null);
    if(issue){$('#new-error').textContent=issue;$('#new-id').focus();return;}
    const kind=$('#new-kind').value,d=subject?structuredClone(subject):makeDoc(id,kind);d.id=id;d.uid=uid();d.title=$('#new-title').value;d.kind=kind;
    state.docs.push(d);dismiss();openDoc(d.uid);
  });
 }
 function manual(){
  const bar='<div class="dialog-choice manual-tabs">'+chip('manual-text','本地化语法',manualTab==='text')+chip('manual-color','颜色表',manualTab==='color')+chip('manual-event','事件脚本',manualTab==='event')+'</div>';
  let body;
  if(manualTab==='color'){
   body='<p>用 § 加一个区分大小写的色码开始着色，用 §! 结束。下表为通用色与工作区自定义色。游戏字体可在 interface/core.gfx 中覆盖通用色。</p><h3>可用色码</h3><div class="manual-grid">'+Object.entries(COLORS).map(([k,[name,hex]])=>'<div class="manual-color"><i class="palette-dot" style="background:'+hex+'"></i><span>§'+k+'</span><small>'+name+'</small></div>').join('')+'</div>';
  }else if(manualTab==='event'){
   body='<h3>新闻和国家事件</h3><p>两者都可以写多个 <code>option</code>。每项的 <code>trigger</code> 决定谁看得到，玩家在一次弹窗中选一项。按国家设置互斥条件，就能让各国只看到各自的一句回应。勾选「向所有国家广播」会生成 <code>major = yes</code>。</p><h3>接收国预览</h3><p>切换画布上方的接收国可以判断 <code>tag</code>、<code>always</code> 及其 AND、OR、NOT 组合。使用 <code>original_recipient_only</code> 时还能切换初始接收国。依赖存档的条件会标为待判定。编辑与导出包含全部选项。</p><h3>导出与游戏内验证</h3><p>选项菜单可以调整顺序及编辑脚本。事件脚本放在 events/，UTF-8 BOM 本地化文件放在 localisation/simp_chinese/。生成的事件使用 is_triggered_only = yes，可在游戏控制台输入 <code>event rhineland.1 FRA</code> 测试。</p>';
  }else{
   const rows=[['§R文字§!','红色文字，§! 结束着色'],['\\n','换行，两个连续换行可分段'],['\\"','正文中的英文双引号'],['$other_key$','嵌套本地化键，自动查找工作区内的条目'],['$$','显示一个美元符号'],['[ROOT.GetName]','当前事件作用域的国家名称，可设置预览值'],['[?score|=+0]','正数显示 +，按正负着色，保留零位小数'],['[?items^0]','读取数组首项，预览值由作者提供'],['£pol_power','读取政治点数图标。多帧图标可写 £图标名|1，帧号从 1 起'],['@FRA','法国的默认旗帜。[FRA.GetFlag] 则取游戏中的当前旗帜']];
   body='<p>点击一段彩色文字、变量、图标或引用，会在原位展开其代码。点击其他段落，刚才的片段恢复预览。色段末尾按 → 可以跳过 §!；右键可在当前位置结束颜色，Esc 跳到色段末尾。</p><h3>常用写法</h3><table class="manual-table"><tbody>'+rows.map(([c,n])=>'<tr><td>'+esc(c)+'</td><td>'+esc(n)+'</td></tr>').join('')+'</tbody></table><p class="hint">选区复制会保留原始标记。动态内容可在预览设置中填写示例值，缺少作用域或贴图时保留原文。拖动预览空白处或插图可平移画布，抓手模式可拖动整张事件。</p>';
  }
  dialogBox('manual','语法手册',bar+body+links,{wide:true,glyph:'book'});
 }
 function outputDocs(){return whole?state.docs:[getDoc()].filter(Boolean);}
 function currentFile(){
  return gameFile(outputDocs(),exportKind,whole?'dispatch_events':eventFileBase(getDoc(),state.docs),idIssue);
 }
 function exportDialog(){
  const {path,text,issues:problems}=currentFile(),bad=problems.length>0;
  dialogBox('export','复制与导出代码','<div class="code-toolbar"><div class="dialog-choice">'+chip('export-loc','本地化 .yml',exportKind==='loc')+chip('export-script','事件脚本 .txt',exportKind==='script')+'</div>'+pick('export-scope','<option value="one" '+(!whole?'selected':'')+'>当前事件</option><option value="all" '+(whole?'selected':'')+'>全部事件</option>')+'</div><label class="code-path" for="export-code">'+esc(path)+'</label><textarea id="export-code" class="code-output" readonly spellcheck="false" aria-label="生成的代码">'+esc(text)+'</textarea>'+problems.map(s=>'<div class="field-error">'+esc(s)+'</div>').join('')+'<div class="dialog-actions"><span class="inline-notice" id="copy-feedback" role="status"></span>'+action('export-download','下载文件','outline','download',bad?'disabled':'')+action('export-copy','复制到剪贴板','primary','copy',bad?'disabled':'')+'</div>',{wide:true,glyph:'code'});
  $('#export-scope').setAttribute('aria-label','导出范围');$('#export-scope').addEventListener('change',e=>{whole=e.target.value==='all';exportDialog();});
 }
 function openSettings(){
  const d=getDoc();if(!d)return;const keys=previewTokens(d);
  settingsDraft={art:d.art,keys};const uploadRevision=++settingsToken;
  const rows=keys.map(k=>'<div class="binding"><code>'+esc(k)+'</code><input aria-label="'+esc(k+' 预览值')+'" data-bind-key="'+esc(k)+'" value="'+esc(d.values[k]??'')+'" placeholder="示例值"></div>').join('');
  const arts='<option value="" '+(!d.art?'selected':'')+'>无插图</option><option value="rhine" '+(d.art==='rhine'?'selected':'')+'>莱茵河畔 · 示例图</option>'+(d.art.startsWith('data:')?'<option value="custom" selected>自定义插图</option>':'');
  dialogBox('settings','预览设置','<form id="settings-form" class="settings-body"><label for="picture-id">事件图片 GFX</label><input id="picture-id" class="mono" placeholder="GFX_…" value="'+esc(d.picture)+'"><label for="preview-art">预览插图</label><div class="code-toolbar">'+pick('preview-art',arts)+action('choose-image','选择本地图片','outline','upload')+'</div><input type="file" id="art-input" hidden accept="image/png,image/jpeg,image/webp"><p class="hint">本地图片只用于此处预览。事件脚本引用上方的 GFX 名称，游戏会读取模组中对应的贴图。</p><label for="font-profile">预览配色</label>'+pick('font-profile','<option value="event">原版事件字体 · typewriter / hoi_20bs</option><option value="generic" '+(state.font==='generic'?'selected':'')+'>原版通用色 · textcolors</option><option value="vic_18_black" '+(state.font==='vic_18_black'?'selected':'')+'>原版字体覆盖 · vic_18_black</option>')+'<details class="mod-colors"><summary>模组自定义色码</summary><label for="mod-colors">textcolors 条目</label><textarea id="mod-colors" class="script-input" rows="3" placeholder="P = { 180 72 210 }">'+esc(writeModColors(state.modColors))+'</textarea><p class="hint">每行填写一个条目，覆盖当前工作区的预览色。自定义颜色在游戏中需要对应的 .gfx 定义。</p></details><h3>动态文本预览值</h3>'+(rows||'<p class="hint">写入 [ROOT.GetName]、[?变量] 或 $引用$ 后，可在这里填写示例值。</p>')+'<div id="setting-error" class="field-error" role="status"></div><div class="dialog-actions">'+action('dismiss','取消')+'<button type="submit" class="primary">应用设置</button></div></form>',{glyph:'settings'});
  $('#preview-art').addEventListener('change',e=>{if(e.target.value!=='custom')settingsDraft.art=e.target.value;else settingsDraft.art=settingsDraft.custom||d.art;});
  $('#art-input').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{
   const src=await resizeImage(file);if(uploadRevision!==settingsToken||section!=='settings')return;
   settingsDraft.art=src;settingsDraft.custom=src;const sel=$('#preview-art');if(!sel.querySelector('option[value=custom]'))sel.add(new Option('自定义插图','custom'));sel.value='custom';$('#setting-error').textContent='';
  }catch(ex){if(section==='settings')$('#setting-error').textContent=ex.message||'图片读取失败。';}});
  $('#settings-form').addEventListener('submit',e=>{e.preventDefault();const pic=$('#picture-id').value.trim();if(pic&&!/^GFX_[A-Za-z0-9_.]+$/.test(pic)){$('#setting-error').textContent='图片名称应以 GFX_ 开头，使用字母、数字、下划线或点。';return;}
   let colors;try{colors=readModColors($('#mod-colors').value);}catch(err){$('#setting-error').textContent=err.message;$('#mod-colors').closest('details').open=true;return;}
   state.modColors=colors;d.picture=pic;d.art=settingsDraft.art;state.font=$('#font-profile').value;
   const values=Object.create(null);for(const el of content.querySelectorAll('[data-bind-key]'))if(el.value!=='')values[el.dataset.bindKey]=el.value;d.values=values;
   dismiss();save();refresh();toast('预览设置已应用');
  });
 }
 function backup(){
  dialogBox('backup','工作区备份','<div class="backup-row"><div><strong>导出工作区</strong><p>保存所有事件、选项、预览设置和打开的标签。</p></div>'+action('save-backup','导出 JSON','outline','download')+'</div><div class="backup-row"><div><strong>从备份恢复</strong><p>载入先前导出的工作区 JSON 文件。</p></div>'+action('restore','选择备份','outline','upload')+'</div><p id="backup-error" class="field-error"></p>',{glyph:'drive'});
 }
 $('#restore-input').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;
  try{const w=JSON.parse((await file.text()).replace(/^\uFEFF/,''));if(!validWorkspace(w))throw new Error('文件格式或事件数据有误。请选择从电文室导出的完整 JSON 备份。');
   restored=w;dialogBox('confirm-restore','恢复工作区','<p>备份中有 '+w.docs.length+' 个事件。恢复会替换浏览器中当前的 '+state.docs.length+' 个事件。</p><div class="dialog-actions">'+action('save-backup','先备份当前工作区')+action('dismiss','取消')+action('restore-confirm','恢复此备份','primary')+'</div>',{glyph:'drive'});
  }catch(err){const el=$('#backup-error');if(el)el.textContent=err instanceof SyntaxError?'无法解析 JSON 备份文件。':err.message;}
 });
 function scriptDialog(k){const d=getDoc(),o=d.options.find(x=>x.key===k);if(!o)return;extraKey=k;
  dialogBox('option-code','选项脚本 · '+k,'<label class="field-label" for="option-script">'+esc(d.id+'.'+k)+'</label><p class="hint" style="margin:5px 0 10px">例如 trigger = { tag = FRA } 只向法国显示此项。也可填写 ai_chance 或选中后的效果。</p><textarea id="option-script" class="script-input" spellcheck="false" placeholder="trigger = { tag = FRA }">'+esc(o.extra)+'</textarea><p class="field-error" id="option-issue" role="status"></p><div class="dialog-actions">'+action('dismiss','取消')+action('save-option-code','保存脚本','primary')+'</div>',{glyph:'braces',focus:'#option-script'});
  const input=$('#option-script'),feedback=()=>{const issue=parseOption(input.value).issue;$('#option-issue').textContent=issue?issue+' 可保留草稿。':'';};
  input.addEventListener('input',feedback);feedback();
 }
 return {handle(a,b){
  const d=getDoc();switch(a){
   case 'dismiss':dismiss();return true;
   case 'new':newDialog(null);return true;
   case 'duplicate':newDialog(state.docs.find(x=>x.uid===b.dataset.uid));return true;
   case 'delete-file':subject=state.docs.find(x=>x.uid===b.dataset.uid);if(!subject)return true;
    dialogBox('delete-file','删除事件','<p>删除 '+esc(subject.id)+' 及其标题、正文和所有选项？</p><div class="dialog-actions">'+action('dismiss','取消')+action('confirm-delete-file','删除事件','outline danger','trash')+'</div>',{glyph:'trash'});return true;
   case 'confirm-delete-file':if(subject){const id=subject.uid,i=state.docs.findIndex(x=>x.uid===id);if(i>=0)state.docs.splice(i,1);dismiss();if(state.tabs.includes(id))closeTab(id);else{save();refresh();}toast('事件已删除');}return true;
   case 'delete-option':extraKey=b.dataset.key;dialogBox('delete-option','删除选项','<p>从 '+esc(d.id)+' 删除选项 '+esc(extraKey)+' 及其脚本？</p><div class="dialog-actions">'+action('dismiss','取消')+action('confirm-delete-option','删除选项','outline danger','trash')+'</div>',{glyph:'trash'});return true;
   case 'confirm-delete-option':if(d.options.length>1)d.options=d.options.filter(o=>o.key!==extraKey);dismiss();save();refresh();return true;
   case 'option-code':scriptDialog(b.dataset.key);return true;
   case 'save-option-code':d.options.find(o=>o.key===extraKey).extra=$('#option-script').value;dismiss();save();refresh();toast('选项脚本已保存');return true;
   case 'manual':manualTab='text';manual();return true;
   case 'manual-color':case 'manual-event':case 'manual-text':manualTab=a.slice(7);manual();return true;
   case 'settings':openSettings();return true;
   case 'choose-image':$('#art-input').click();return true;
   case 'export':whole=false;exportDialog();return true;
   case 'export-loc':case 'export-script':exportKind=a.slice(7);exportDialog();return true;
   case 'export-copy':clipboard(currentFile().text).then(ok=>{const el=$('#copy-feedback');if(el)el.textContent=ok?'已复制原始代码':'代码已选中，请按 Ctrl+C 或 ⌘C。';});return true;
   case 'export-download':{const f=currentFile();if(!f.issues.length){downloadBlob(f.name,fileBlob(f));$('#copy-feedback').textContent='已生成下载文件';}return true;}
   case 'backup':backup();return true;
   case 'restore':$('#restore-input').click();return true;
   case 'save-backup':downloadBlob('hoi4-dispatch-'+isoDate()+'.json',new Blob([JSON.stringify(state,null,2)],{type:'application/json;charset=utf-8'}));toast('已导出工作区备份');return true;
   case 'restore-confirm':if(restored){const w=upgradeWorkspace(restored);Object.assign(state,{version:1,docs:w.docs,tabs:w.tabs,active:w.active,font:w.font||'event',modColors:w.modColors||{},previewTag:w.previewTag,originalRecipient:w.originalRecipient});resetDrafts();dismiss();save();refresh({reset:true});toast('工作区已恢复');}return true;
   default:return false;
  }
 }};
}
