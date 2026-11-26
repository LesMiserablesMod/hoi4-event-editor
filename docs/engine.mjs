const BASE_COLORS = Object.freeze({
  Y:['黄色','#ffbd00'], R:['红色','#ff3232'], G:['绿色','#009f03'], C:['青色','#23ceff'],
  O:['橙色','#ff7019'], B:['蓝色','#0000ff'], W:['白色','#ffffff'], g:['浅灰','#b0b0b0'],
  L:['灰褐','#c3b091'], H:['标题黄','#ffbd00'], T:['标题白','#ffffff'], b:['黑色','#000000'],
  '0':['紫色','#cb00cb'], '1':['淡紫','#8078d3'], '2':['靛蓝','#5170f3'], '3':['灰蓝','#518fdc'],
  '4':['浅蓝','#5abee7'], '5':['青蓝','#3fb5c2'], '6':['绿松石','#77ccba'], '7':['浅绿','#99d199'],
  '8':['赭黄','#cca333'], '9':['杏色','#fca97d'], t:['亮红','#ff4c4d']
});
export let COLORS = {...BASE_COLORS};
let colorToken = /§[CLWBGRbgYHTO0-9t!]/g;
const baseSymbols = /§[CLWBGRbgYHTO0-9t!]|\\[n"]|\$\$|\$[A-Za-z0-9_.-]+(?:\|[^$\s]+)?\$|\[[^\[\]\r\n]+\]|£[A-Za-z0-9_]+(?:\|\d+)?|@[A-Z][A-Z0-9]{2}(?![A-Za-z0-9_])|\r\n|\n/g;
const owns = (obj,key) => Object.prototype.hasOwnProperty.call(obj,key);
let symbols=baseSymbols;
export const EVENT_INK={G:'#56ac5b',R:'#de5646',Y:'#eec923',H:'#eec923',T:'#ffffff'};
export const VIC_INK={Y:'#000000',H:'#dbcb47',G:'#18701a',R:'#7c1818',T:'#ffffff'};

export function useModColors(overrides={}) {
  COLORS={...BASE_COLORS};
  for(const [code,value] of Object.entries(overrides)){
    if(/^[a-z0-9]$/i.test(code)&&/^#[0-9a-f]{6}$/i.test(value))COLORS[code]=[BASE_COLORS[code]?.[0]||'自定义',value];
  }
  const keys=Object.keys(COLORS).join('')+'!';
  colorToken=new RegExp('§['+keys+']','g');
  symbols=new RegExp(baseSymbols.source.replace('CLWBGRbgYHTO0-9t!',keys),'g');
}
export function readModColors(text) {
  const map=Object.create(null);
  for(const [n,line] of text.split(/\r?\n/).entries()){
    const clean=line.split('#')[0].trim();if(!clean)continue;
    const m=clean.match(/^([A-Za-z0-9])\s*=\s*\{\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*\}$/);
    if(!m||m.slice(2).some(v=>Number(v)>255))throw new Error('第 '+(n+1)+' 行色码有误，请按 P = { 180 72 210 } 输入，RGB 范围为 0–255。');
    map[m[1]]='#'+m.slice(2).map(v=>Number(v).toString(16).padStart(2,'0')).join('');
  }
  return map;
}
export function writeModColors(map={}){
  return Object.entries(map).map(([k,hex])=>k+' = { '+hex.slice(1).match(/../g).map(v=>parseInt(v,16)).join(' ')+' }').join('\n');
}
function markAt(raw,pos){
  return pos>=0&&raw[pos]==='§'&&(raw[pos+1]==='!'||owns(COLORS,raw[pos+1]));
}
const flagAssets=new Set('FRA ENG GER USA SOV ITA JAP CHI GRE POL BEL HOL CZE CAN SPR YUN PRC GXC MAN XSM SHX SIK AUS SWE NOR FIN DEN POR HUN ROM TUR SWI BRA MEX RAJ AST NZL SAF PER ARG ETH BUL YUG'.split(' '));
const iconAssets=new Set('stability_texticon manpower_texticon army_experience navy_experience air_experience pol_power decision_icon_small'.split(' '));
export const TYPE_NAMES = {country_event:'国家事件',news_event:'新闻事件'};

function bracketKind(token){
  const name=token.slice(1,-1);
  if(/^\?[A-Za-z0-9_:.-]+(?:[@^][A-Za-z0-9_:.-]+)*(?:\|[^|\s\[\]]+)?$/.test(name))return 'variable';
  if(/^[A-Za-z0-9_:]+(?:\.[A-Za-z0-9_:]+)*$/.test(name))return 'scope';
  return 'text';
}
export function scan(raw) {
  const result=[]; let start=0, color='';
  const append=(kind,value,from,to) => result.push({kind,value,from,to,color});
  for (const match of raw.matchAll(symbols)) {
    const pos=match.index, tok=match[0], end=pos+tok.length;
    if(start<pos) append('text',raw.slice(start,pos),start,pos);
    if(tok[0]==='§'){color=tok[1]==='!'?'':tok[1]; append('mark',tok,pos,end);}
    else if(tok==='\\n'||tok==='\n'||tok==='\r\n') append('break','\n',pos,end);
    else if(tok==='$$'||tok==='\\"') append('escape',tok==='$$'?'$':tok[1],pos,end);
    else append(tok[0]==='£'?'icon':tok[0]==='@'?'flag':tok[0]==='$'?'reference':bracketKind(tok),tok,pos,end);
    start=end;
  }
  if(start<raw.length) append('text',raw.slice(start),start,raw.length);
  return result;
}
export const colorAt=(raw,pos)=>{let c='';for(const m of raw.slice(0,pos).matchAll(colorToken))c=m[0][1]==='!'?'':m[0][1];return c;};
export function syntaxRegion(raw,pos){
  const parts=scan(raw);let start=null;
  for(const t of parts){
    if(t.kind==='mark'){
      if(t.value==='§!'){
        if(start!==null&&pos>=start&&pos<t.to)return {from:start,to:t.to,kind:'color'};
        start=null;
      }else{
        if(start!==null&&pos>=start&&pos<t.from)return {from:start,to:t.from,kind:'color'};
        start=t.from;
      }
    }else if(t.kind!=='text'&&pos>=t.from&&pos<t.to){
      return {from:t.from,to:t.to,kind:t.kind};
    }
  }
  return start!==null&&pos>=start&&pos<=raw.length?{from:start,to:raw.length,kind:'color'}:null;
}
export function localisationIssue(raw){
  let open='';
  for(const m of raw.matchAll(/§([\s\S]?)/g)){
    const code=m[1];
    if(code==='!'){open='';continue;}
    if(!owns(COLORS,code))return '未定义的色码 '+m[0]+'。可在预览设置中登记模组的 textcolors。';
    if(open)return '§'+open+' 应先用 §! 结束，再开始 §'+code+'。';
    open=code;
  }
  if(open)return '§'+open+' 缺少结束标记 §!。';
  for(const t of scan(raw)){
    if(t.kind==='icon' && /\|0+$/.test(t.value))return '图标帧号从 1 开始：'+t.value;
    if(t.kind==='icon'&&raw[t.to]==='|')return '图标帧号应为从 1 开始的整数。';
    if(t.kind==='text'&&/\$/.test(t.value))return '本地化引用应写成 $键名$，显示美元符号请写 $$。';
    if(t.kind==='text'&&/\[\?[^\[\]]*(?:$|\n)/.test(t.value))return '变量表达式缺少 ] 或名称格式有误。';
    if(t.kind==='text' && /\[(?:\?|[A-Za-z0-9_:]+\.)[^\[\]\n]*\|[^\[\]\n]*\]/.test(t.value))
      return '请检查方括号语法。数值格式写在 [?变量|格式] 中，普通作用域文本可用 §色码…§! 着色。';
  }
  return '';
}
export function toSourceText(val) {
  return val.replace(/\r\n?/g,'\n').replace(/\n/g,'\\n').replace(/(\\*)"/g,(_,slashes)=>slashes+(slashes.length%2?'':'\\')+'"');
}
export function formatNumber(input,flags) {
  const num=Number(input);
  if(!flags || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(input).trim()) || !Number.isFinite(num)) return {text:String(input),color:''};
  let n=num, suffix='';
  const precision=[...flags].filter(c=>/\d/.test(c)).pop();
  const conversions=flags.match(/%%|[%*^]/g)||[];
  const conversion=conversions.filter(s=>s!=='%'||!conversions.includes('%%')).at(-1);
  if(conversion==='%%')suffix='%';
  else if(conversion==='%'){n*=100;suffix='%';}
  else if(conversion) {
    if(Math.abs(n)>=1e6){n/=1e6;suffix='M';}
    else if(Math.abs(n)>=1e3){n/=1e3;suffix='K';}
  }
  let text=String(n);
  if(precision!==undefined)text=n.toFixed(Math.min(5,Number(precision)));
  else if(conversion==='%')text=n.toFixed(1)+'0';
  else if(conversion==='*'||conversion==='^')text=(Math.trunc(n*100)/100).toFixed(2);
  if(flags.includes('=')&&num>0)text='+'+text;
  const dynamic=[...flags].filter(c=>c==='+'||c==='-').pop();
  const color=dynamic?(num===0?'Y':((num>0)===(dynamic==='+')?'G':'R')):([...flags].filter(c=>/[A-Za-z]/.test(c)&&owns(COLORS,c)).pop()||'');
  return {text:text+suffix,color};
}
export function resolveToken(token,ctx={},seen=new Set(),budget={remaining:4096}) {
  const orig=token.value;
  if(token.kind==='text'||token.kind==='escape'||token.kind==='break') return {text:orig};
  if(token.kind==='icon') {
    const [name,frame]=orig.slice(1).replace(/^GFX_/,'').split('|');
    return iconAssets.has(name)&&(!frame||Number(frame)===1)?{image:'assets/inline/'+name+'.png',text:'\uFFFC',hint:orig}:{text:orig,missing:true,hint:'此图标或指定帧需要游戏或模组贴图'};
  }
  if(token.kind==='flag') {
    const tag=orig.slice(1);
    return flagAssets.has(tag)?{image:'assets/inline/flag-'+tag+'.png',text:'\uFFFC',hint:orig+' · 默认国旗'}:{text:orig,missing:true,hint:'需要 '+tag+'.tga 的默认国旗贴图'};
  }
  const inside=orig.slice(1,-1), pipe=inside.indexOf('|');
  const key=pipe<0?inside:inside.slice(0,pipe), fmt=pipe<0?'':inside.slice(pipe+1);
  const values=ctx.values||{}, entries=ctx.entries||{};
  const found=[orig,orig[0]+key+orig.at(-1)].find(k=>owns(values,k));
  if(found!==undefined) {
    const val=String(values[found]);const n=token.kind==='scope'?{text:val,color:''}:formatNumber(val,fmt);
    const literalColor=[...fmt].filter(c=>/[a-zA-Z]/.test(c)&&owns(COLORS,c)).pop();
    return {...n,color:n.color||literalColor||'',hint:orig+' · 预览值'};
  }
  if(token.kind==='reference'&&owns(entries,key)&&!seen.has(key)&&seen.size<12&&budget.remaining>0){
    const next=new Set(seen);next.add(key);
    budget.remaining--;
    const ink=[...fmt].filter(c=>/[A-Za-z]/.test(c)&&owns(COLORS,c)).pop()||'';
    return {parts:materialize(entries[key],ctx,next,budget),color:ink,text:'',hint:orig};
  }
  return {text:orig,missing:true,hint:orig+' · 尚未绑定预览值'};
}
export function materialize(raw,ctx={},seen=new Set(),budget={remaining:4096}){
  return scan(raw).filter(t=>t.kind!=='mark').map(t=>({...t,display:resolveToken(t,ctx,seen,budget)}));
}
export function displayText(raw,ctx={}) {
  const collect=ts=>ts.map(t=>t.display.parts?collect(t.display.parts):t.display.text).join('');
  return collect(materialize(raw,ctx));
}
export function copyPart(raw,a,b){
  if(a>b)[a,b]=[b,a]; if(a===b)return '';
  if(a===0&&b===raw.length)return raw;
  let start=a,end=b;
  while(markAt(raw,start-2)&&raw[start-1]!=='!')start-=2;
  if(raw.slice(end,end+2)==='§!')end+=2;
  const initial=colorAt(raw,start), last=colorAt(raw,end), sub=raw.slice(start,end);
  return (initial&&!sub.startsWith('§')?'§'+initial:'')+sub+(last?'§!':'');
}
// Applying colour replaces the selection's colour runs and restores the next character's colour.
export function applyColor(raw,a,b,code){
  let left=a,right=b;
  if(a!==b){
    while(markAt(raw,left-2))left-=2;
    while(markAt(raw,right))right+=2;
  }
  const startColor=colorAt(raw,left), endColor=colorAt(raw,right);
  const prefix=raw.slice(0,left), suffix=raw.slice(right);
  const change=(before,after)=>before===after?'':(before?'§!':'')+(after?'§'+after:'');
  const open=change(startColor,code), close=change(code,endColor);
  const middle=raw.slice(a,b).replace(colorToken,'');
  const at=left+open.length+middle.length;
  return {raw:prefix+open+middle+close+suffix,at:a!==b&&close.startsWith('§!')?at+2:at};
}
// Leave a run without touching neighbouring glyphs or consuming the next opening marker.
export function leaveColor(raw,pos,toEnd=false){
  const code=colorAt(raw,pos);
  if(!code)return {raw,at:pos};
  const next=[...raw.slice(pos).matchAll(colorToken)][0], boundary=next?pos+next.index:raw.length;
  if(toEnd)pos=boundary;
  if(raw.startsWith('§!',pos))return {raw,at:pos+2};
  const resume=pos<boundary?'§'+code:'';
  return {raw:raw.slice(0,pos)+'§!'+resume+raw.slice(pos),at:pos+2};
}
export const validId=id=>/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*\.\d+$/.test(id);
export const namespaceOf=id=>id.slice(0,id.lastIndexOf('.'));
export const identityKey=id=>validId(id)?namespaceOf(id)+'.'+id.slice(id.lastIndexOf('.')+1).replace(/^0+(?=\d)/,''):id;
export function idError(id,docs,uid){
 if(!validId(id))return '请使用命名空间和数字编号，例如 france.1。';
 return docs.some(d=>d.uid!==uid&&identityKey(d.id)===identityKey(id))?'这个事件 ID 已被占用。':'';
}
export function nextSuffix(opts){
 const used=new Set(['d','t',...opts.map(o=>o.key)]);for(let i=1;;i++){let n=i,s='';while(n){n--;s=String.fromCharCode(97+n%26)+s;n=Math.floor(n/26);}if(!used.has(s))return s;}
}
export function localisationEntries(docs){
 const entries=Object.create(null);
 for(const d of docs){entries[d.id+'.t']=d.title;entries[d.id+'.d']=d.desc;for(const o of d.options)entries[d.id+'.'+o.key]=o.text;}
 return entries;
}
export function localisationCode(docs){
 return 'l_simp_chinese:\n'+Object.entries(localisationEntries(docs)).map(([k,v])=>' '+k+':0 "'+toSourceText(v)+'"').join('\n')+'\n';
}
export function scriptCode(docs){
 const spaces=[...new Set(docs.map(d=>namespaceOf(d.id)))];
 const blocks=docs.map(d=>{
  const head=[d.kind+' = {','    id = '+d.id,'    title = '+d.id+'.t','    desc = '+d.id+'.d'];
  if(d.picture)head.push('    picture = '+d.picture);
  if(d.major)head.push('    major = yes');
  head.push('    is_triggered_only = yes');
  const opts=d.options.map(o=>{
    const lines=['    option = {','        name = '+d.id+'.'+o.key];
    if(o.extra?.trim())for(const line of o.extra.trim().split(/\r?\n/))lines.push('        '+line);
    return [...lines,'    }'].join('\n');
  });
  return head.join('\n')+'\n\n'+opts.join('\n\n')+'\n}';
 });
 return spaces.map(v=>'add_namespace = '+v).join('\n')+'\n\n'+blocks.join('\n\n')+'\n';
}
