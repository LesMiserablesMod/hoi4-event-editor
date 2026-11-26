import test from 'node:test';
import assert from 'node:assert/strict';
import {applyColor,colorAt,copyPart,displayText,formatNumber,idError,leaveColor,localisationCode,localisationIssue,materialize,nextSuffix,readModColors,scan,scriptCode,syntaxRegion,toSourceText,useModColors,writeModColors} from '../docs/engine.mjs';
import {makeDoc,seeds,upgradeWorkspace,validWorkspace} from '../docs/store.mjs';
import {parseOption,optionVisibility} from '../docs/options.mjs';

test('Rendered localisation and selected source retain different representations',()=>{
 const raw='简报：§R警戒状态§!\\n[ROOT.GetName] £mod_icon|2，$$10，\\"原文\\"。';
 assert.equal(displayText(raw,{values:{'[ROOT.GetName]':'法国'}}),'简报：警戒状态\n法国 £mod_icon|2，$10，"原文"。');
 assert.equal(copyPart(raw,raw.indexOf('戒'),raw.indexOf('状')+1),'§R戒状§!');
 assert.equal(copyPart(raw,0,raw.length),raw);
 assert.equal(toSourceText('甲\n乙 "丙" \\n\\"丁\\"'),'甲\\n乙 \\"丙\\" \\n\\"丁\\"');
});
test('Recoloring a run keeps adjacent text intact and leaves no superseded markers',()=>{
 const raw='一§R二三§!四';const a=raw.indexOf('二'),b=raw.indexOf('§!');
 assert.equal(applyColor(raw,a,b,'G').raw,'一§G二三§!四');
 assert.equal(applyColor(raw,a,b,'').raw,'一二三四');
 assert.equal(applyColor(raw,a+1,b,'G').raw,'一§R二§!§G三§!四');
 const insert=applyColor('初稿',2,2,'Y');assert.deepEqual(insert,{raw:'初稿§Y§!',at:4});
});
test('Variable formatting, local references and bounded cycles',()=>{
 assert.deepEqual(formatNumber(.256,'=+%1'),{text:'+25.6%',color:'G'});
 assert.deepEqual(formatNumber(-3,'-0'),{text:'-3',color:'G'});
 const context={entries:{a:'$b$',b:'§Y乙§!',loop:'$loop$'},values:{'[?v]':'0.25'}};
 assert.equal(displayText('$a$ / [?v|%0] / $loop$',context),'乙 / 25% / $loop$');
 assert.equal(materialize('$a|R$',context)[0].display.color,'R');
});
test('Mod-specific symbols retain their exact source and case',()=>{
 const custom=readModColors('P = { 180 72 210 }\n# comment\nR = { 120 20 4 }');
 assert.equal(custom.P,'#b448d2');assert.equal(readModColors(writeModColors(custom)).R,'#781404');
 assert.throws(()=>readModColors('P = { 300 0 0 }'));
 try{useModColors(custom);assert.equal(displayText('§P紫色§!'),'紫色');assert.equal(copyPart('§P紫色§!',3,4),'§P色§!');}
 finally{useModColors();}
 assert.equal(displayText('§P未知§!'),'§P未知');
});
test('Each exported option keeps its key through reorders, including after the 26th option',()=>{
 const d=makeDoc('mod.france.12','news_event','巴黎');d.desc='消息\\n来自 §G巴黎§!。';
 for(let i=1;i<32;i++)d.options.push({key:nextSuffix(d.options),text:'选项 '+i,extra:''});
 d.options.reverse();d.options[0].extra='add_political_power = 5';
 assert.equal(new Set(d.options.map(x=>x.key)).size,32);assert(!d.options.some(x=>['t','d'].includes(x.key)));
 const loc=localisationCode([d]);assert.equal(loc.split('.d:0').length,2);assert(loc.includes('消息\\n来自 §G巴黎§!。'));
 const script=scriptCode([d,{...makeDoc('mod.france.13')}]);assert.equal(script.match(/add_namespace/g).length,1);
 assert(script.includes('name = '+d.id+'.'+d.options[0].key+'\n        add_political_power = 5'));assert.equal(script.match(/option = \{/g).length,33);
});
test('Workspace validation and equivalent numeric ids',()=>{
 const w=seeds();assert(validWorkspace(JSON.parse(JSON.stringify(w))));
 assert(idError('rhineland.001',w.docs,null));assert(!idError('alt.france.3',w.docs,null));assert(idError('FRA',w.docs,null));
 const broken=structuredClone(w);broken.docs[0].options[0].key='t';assert(!validWorkspace(broken));
 assert(validWorkspace({...w,font:'event',modColors:{P:'#998800'}}));assert(!validWorkspace({...w,modColors:{PP:'#998800'}}));
 assert(validWorkspace({...w,tabs:[],active:null}));assert(validWorkspace({...w,docs:[],tabs:[],active:null}));
});

test('Caret exits a colour without recolouring existing text',()=>{
 const raw='起§R甲乙§!止';
 const mid=raw.indexOf('乙'),closed=leaveColor(raw,mid,true);
 assert.deepEqual(closed,{raw,at:raw.indexOf('止')});
 const split=leaveColor(raw,mid);assert.equal(split.raw,'起§R甲§!§R乙§!止');assert.equal(colorAt(split.raw,split.at),'');
 const end=leaveColor('§R甲',3,true);assert.deepEqual(end,{raw:'§R甲§!',at:5});
 const selection=applyColor('前红字后',1,3,'R');
 assert.equal(colorAt(selection.raw,selection.at),'');assert.equal(selection.raw,'前§R红字§!后');
});
test('Only the selected colour run or embedded expression opens',()=>{
 const raw='前§R甲[?score|.1]乙§!后 $loc.key$';
 const red=syntaxRegion(raw,raw.indexOf('甲')),num=syntaxRegion(raw,raw.indexOf('score'));
 assert.equal(raw.slice(red.from,red.to),'§R甲[?score|.1]乙§!');
 assert.equal(raw.slice(num.from,num.to),'[?score|.1]');assert.equal(num.kind,'variable');
 assert.equal(syntaxRegion(raw,raw.indexOf('后')),null);assert.equal(syntaxRegion(raw,raw.indexOf('$')).kind,'reference');
});
test('Wiki variable formats and actual assets render only in the appropriate contexts',()=>{
 assert.deepEqual(formatNumber(65536,'*'),{text:'65.53K',color:''});
 assert.deepEqual(formatNumber(1500000,'^'),{text:'1.50M',color:''});
 assert.deepEqual(formatNumber(.256,'%=+Y'),{text:'+25.60%',color:'G'});
 assert.deepEqual(formatNumber(0,'-9'),{text:'0.00000',color:'Y'});
 assert.equal(formatNumber(4.5,'.1%%').text,'4.5%');
 assert.equal(scan('[?list^index]')[0].kind,'variable');assert.equal(scan('[GetMyScriptedLoc]')[0].kind,'scope');
 assert.equal(scan('[ROOT.GetName|R]')[0].kind,'text');assert.equal(scan('[not an expression]')[0].kind,'text');
 assert.equal(displayText(String.raw`a\tb\\c`),String.raw`a\tb\\c`);
 assert.ok(materialize('@FRA')[0].display.image);assert.ok(materialize('£GFX_army_experience|1')[0].display.image);
 assert.equal(displayText('£political_power @ABC'),'£political_power @ABC');
 assert.match(localisationIssue('§P未知§!'),/未定义/);assert.match(localisationIssue('§R红'),/缺少/);
 assert.ok(localisationIssue('£icon|0'));assert.equal(localisationIssue('§R赤§!§G绿§! [scripted_loc] £mod_icon|2'),'');
});
test('News option visibility is per recipient and never restricts export',()=>{
 const news=seeds().docs[0],view={tag:'FRA',major:true,original:true};
 const vis=(s,over={})=>optionVisibility(parseOption(s),{...view,...over});
 assert.deepEqual(news.options.map(o=>vis(o.extra)),[false,true]);
 assert.deepEqual(news.options.map(o=>vis(o.extra,{tag:'GER'})),[true,false]);
 assert.equal(vis(''),true);assert.equal(vis('original_recipient_only = yes',{original:false}),false);
 assert.equal(vis('trigger = { has_country_flag = mystery }'),null);
 assert.equal(vis('trigger = { NOT = { tag = GER tag = ENG } }'),true);
 assert.equal(vis('trigger = { OR = { has_country_flag = mystery tag = FRA } }'),true);
 assert.equal(vis('trigger = { tag = GER has_war = yes }'),false);
 news.options.push({key:'c',text:'共同选项',extra:'# quotes and braces in a comment: "{ }\nadd_political_power = 5'});
 assert.deepEqual(news.options.map(o=>vis(o.extra)),[false,true,true]);
 assert.match(scriptCode([news]),/major = yes/);
 assert.equal(scriptCode([news]).match(/option = \{/g).length,3);assert.match(localisationCode([news]),/rhineland\.1\.c/);
 for(const bad of ['trigger = tag','trigger = { tag = FRA','bogus_effect = yes','name = other','trigger = { always = YES }','trigger = { tag == FRA }']){
   assert.ok(parseOption(bad).issue,bad);
 }
 assert.equal(parseOption('ai_chance = { factor = 1 modifier = { tag = FRA factor = 2 } }\nadd_political_power = 10').issue,'');
});
test('Only the pristine demo migrates to broadcast and recipient-specific options',()=>{
 const w=seeds();for(const d of w.docs)delete d.major;
 const original=w.docs[0];original.options.forEach(o=>o.extra='');
 const edited=structuredClone(w);edited.docs[0].desc+=' 已修订';
 assert.equal(upgradeWorkspace(edited).docs[0].major,false);assert.equal(edited.docs[0].options[0].extra,'');
 upgradeWorkspace(w);assert.equal(original.major,true);assert.match(original.options[0].extra,/NOT/);
 assert(validWorkspace(w));
});
