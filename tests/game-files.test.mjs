import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDoc,seeds} from '../docs/store.mjs';
import {eventFileBase,fileBlob,selectedFiles} from '../docs/game-files.mjs';

const valid=()=>'';
test('Only the checked events are merged; exported files have game-ready bytes',async()=>{
 const {docs}=seeds(),chosen=[docs[0],docs[2]];
 const [script,loc]=selectedFiles(chosen,false,docs,valid);
 assert.equal(script.path,'events/rhineland_events.txt');
 assert.equal(loc.path,'localisation/simp_chinese/rhineland_events_l_simp_chinese.yml');
 assert.equal(script.text.match(/add_namespace = rhineland/g).length,1);
 assert.match(script.text,/tag = FRA/);assert.doesNotMatch(script.text,/rhineland\.2/);
 assert.match(loc.text,/§R加急§!/);assert.match(loc.text,/\[ROOT.GetName\]/);
 assert.doesNotMatch(loc.text,/rhineland\.2/);
 const bytes=new Uint8Array(await fileBlob(loc).arrayBuffer());
 assert.deepEqual([...bytes.slice(0,3)],[0xef,0xbb,0xbf]);
 assert.equal(new TextDecoder().decode(bytes),loc.text);
 assert.equal(new Uint8Array(await fileBlob(script).arrayBuffer())[0],97);
 assert.deepEqual(selectedFiles([],false,docs,valid),[]);
});

test('Individual files and names stay stable when selecting subsets across namespaces',()=>{
 const a=makeDoc('mod.france.1'),b=makeDoc('mod_france.1'),workspace=[a,b];
 const both=selectedFiles(workspace,true,workspace,valid);
 assert.equal(new Set(both.map(f=>f.name.toLowerCase())).size,4);
 assert.equal(selectedFiles([b],false,workspace,valid)[0].name,both[2].name);
 assert.equal(eventFileBase(makeDoc('news.5'),[]),'news_5');
 assert.equal(both[0].text.match(/option = \{/g).length,1);
 const [merged]=selectedFiles(workspace,false,workspace,valid);
 assert.equal(merged.name,'dispatch_events.txt');
 assert.match(merged.text,/add_namespace = mod\.france\nadd_namespace = mod_france/);
});

test('Errors are checked per file, including unsaved event ID drafts',()=>{
 const {docs}=seeds(),affected=docs[1];affected.desc='§R未结束';
 const fs=selectedFiles([affected],false,docs,valid);
 assert.deepEqual(fs[0].issues,[]);assert.match(fs[1].issues[0],/rhineland\.2\.d/);
 affected.options[0].extra='trigger = {';
 const files=selectedFiles([affected],true,docs,()=> '请修正事件 ID。');
 assert.ok(files.every(f=>f.issues.some(s=>s.includes('事件 ID'))));
 assert.ok(files[0].issues.some(s=>s.includes('.a')));
 assert.deepEqual(selectedFiles([docs[0]],false,docs,valid).flatMap(f=>f.issues),[]);
});
