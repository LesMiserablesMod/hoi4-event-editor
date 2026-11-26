import {triggerNames,effectNames} from './script-names.mjs';

export const tagPattern=/^[A-Z][A-Z0-9]{2}$/;
const booleanValue=v=>v==='yes'||v==='no';
const scopeName=k=>tagPattern.test(k)||/^\d+$/.test(k)||/^(?:(?:ROOT|THIS|(?:FROM)+|(?:PREV)+)(?:\.|$)|(?:event_target|global_event_target|var):)/i.test(k);
const flowEffects=new Set(['if','else_if','else','hidden_effect','effect_tooltip','while','random','random_list']);
const logic=new Set(['and','or','not','hidden_trigger']);

// Preserve comments and formatting in the saved script. This tree is for structural checks and preview only.
function parseScript(source){
  const tokens=source.match(/#[^\r\n]*|"(?:\\[\s\S]|[^"\\])*"|[{}]|[<>=!]+|[^\s{}<>=!#"]+|"/g)?.filter(t=>t[0]!=='#')||[];
  let i=0;
  function block(depth){
    if(depth>100)throw Error('脚本嵌套超过可校验的深度。');
    const nodes=[];
    while(i<tokens.length){
      const key=tokens[i++];
      if(key==='}'){if(depth)return nodes;throw Error('多出一个右花括号 }。');}
      if(key==='"')throw Error('双引号尚未闭合。');
      if(key==='{'||/^[!<>=]+$/.test(key))throw Error('运算符或花括号前缺少名称。');
      const op=tokens[i];
      if(!op||!/^[!<>=]+$/.test(op)){nodes.push({key,op:'',value:null});continue;}
      i++;
      const token=tokens[i++];
      if(!token||token==='}'||/^[!<>=]+$/.test(token))throw Error(key+' 缺少值。');
      if(token==='"')throw Error('双引号尚未闭合。');
      nodes.push({key,op,value:token==='{'?block(depth+1):token});
    }
    if(depth)throw Error('缺少右花括号 }。');
    return nodes;
  }
  return block(0);
}
function checkTrigger(nodes){
  for(const {key,op,value} of nodes){
    const k=key.toLowerCase();
    if(!op)throw Error(key+' 缺少运算符。');
    if(!['=','<','>'].includes(op))throw Error(key+' 使用了未收录的条件运算符 '+op+'。');
    if(logic.has(k)){
      if(!Array.isArray(value)||op!=='=')throw Error(key+' 应使用 = { … }。');
      checkTrigger(value);
    }else if(k==='always'){
      if(op!=='='||!booleanValue(value))throw Error('always 应写成 always = yes 或 always = no。');
    }else if(k==='tag'){
      if(op!=='='||typeof value!=='string')throw Error('tag 应写成 tag = FRA 或指向一个国家的作用域。');
    }else if(!triggerNames.has(k)&&!scopeName(key)){
      throw Error('Wiki 条件表中未收录 '+key+'。自定义触发器需要模组定义。');
    }
  }
}
function validate(nodes){
  const once=new Set();
  for(const {key,op,value} of nodes){
    const k=key.toLowerCase();
    if(op!=='=')throw Error(key+' 应使用赋值符号 =。');
    if(k==='name')throw Error('选项名称由编辑器生成，请在选项文字栏填写。');
    if(['trigger','ai_chance','original_recipient_only'].includes(k)){
      if(once.has(k))throw Error('同一选项重复定义了 '+key+'。');
      once.add(k);
    }
    if(k==='trigger'){if(!Array.isArray(value))throw Error('trigger 应写成 trigger = { … }。');checkTrigger(value);}
    else if(k==='original_recipient_only'){
      if(!booleanValue(value))throw Error('original_recipient_only 的值应为 yes 或 no。');
    }else if(k==='ai_chance'){
      if(!Array.isArray(value))throw Error('ai_chance 应写成 ai_chance = { … }。');
      for(const n of value){
        if(n.op!=='='||!['base','add','factor','modifier'].includes(n.key.toLowerCase()))throw Error('请检查 ai_chance 中的 '+n.key+'。');
        if(n.key.toLowerCase()==='modifier'){
          if(!Array.isArray(n.value))throw Error('modifier 应使用 = { … }。');
          checkTrigger(n.value.filter(t=>!['factor','add','base'].includes(t.key.toLowerCase())));
        }
      }
    }else if(!effectNames.has(k)&&!flowEffects.has(k)&&!scopeName(key)){
      throw Error('Wiki 效果表中未收录 '+key+'。自定义效果需要模组定义。');
    }
  }
}
function checkEffectBody(nodes){
  for(const n of nodes){
    const k=n.key.toLowerCase();
    if(k==='limit'){
      if(n.op!=='='||!Array.isArray(n.value))throw Error('limit 应使用 = { … }。');
      checkTrigger(n.value);continue;
    }
    if(n.op!=='='||(!effectNames.has(k)&&!flowEffects.has(k)&&!scopeName(n.key)))
      throw Error('请检查效果块中的 '+n.key+'。自定义效果需要模组定义。');
    checkNestedEffect(n);
  }
}
function checkNestedEffect({key,value}){
  const k=key.toLowerCase();
  if(['if','else_if','else','while','hidden_effect'].includes(k)||scopeName(key)&&!effectNames.has(k)){
    if(!Array.isArray(value))throw Error(key+' 应使用 = { … }。');
    checkEffectBody(value);
  }
}
export function parseOption(source=''){
  try{const nodes=parseScript(source);validate(nodes);nodes.forEach(checkNestedEffect);return {nodes,issue:''};}
  catch(e){return {nodes:[],issue:e.message};}
}
const allTrue=items=>items.includes(false)?false:items.includes(null)?null:true;
const anyTrue=items=>items.includes(true)?true:items.includes(null)?null:false;
function evaluate(nodes,tag,mode='and'){
  const results=nodes.map(({key,op,value})=>{
    const k=key.toLowerCase();if(op!=='=')return null;
    if(k==='tag'&&tagPattern.test(value)&&tagPattern.test(tag))return tag===value;
    if(k==='always')return value.toLowerCase()==='yes';
    if(logic.has(k))return evaluate(value,tag,k);
    return null;
  });
  if(mode==='not'){const any=anyTrue(results);return any===null?null:!any;}
  return mode==='or'?anyTrue(results):allTrue(results);
}
export function optionVisibility(parsed,{tag,major,original}){
  if(parsed.issue)return null;
  return allTrue(parsed.nodes.map(({key,value})=>{
    const k=key.toLowerCase();
    if(k==='original_recipient_only'&&major&&value.toLowerCase()==='yes')return original;
    return k==='trigger'?evaluate(value,tag):true;
  }));
}
