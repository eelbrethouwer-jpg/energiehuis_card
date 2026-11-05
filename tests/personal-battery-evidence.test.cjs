'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const registry=new Map();
class Element{attachShadow(){return {addEventListener(){}};}}
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,Intl,window:{customCards:[]},customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},HTMLElement:Element};
vm.runInNewContext(fs.readFileSync('energiehuis-card.js','utf8')+'\n;globalThis.evidence={eh30PersonalEvidence,eh30PersonalEvidenceHtml};',ctx);
const {eh30PersonalEvidence:a,eh30PersonalEvidenceHtml:html}=ctx.evidence;
const t=Date.parse('2026-10-24T00:00:00Z');
const row=i=>({t:t+i*3600000,end:t+(i+1)*3600000,import:2,export:1,price:.2});
test('whole missing intervals reduce coverage; duplicate rows never inflate energy',()=>{
 const q=a([row(0),row(2),row(2)]);
 assert.equal(q.expected,3);assert.equal(q.valid,2);assert.equal(q.missing,1);
 assert.equal(q.duplicates,1);assert.equal(q.imported,4);assert.equal(q.coverage,2/3);
});
test('invalid energy, duration and prices are reported separately',()=>{
 const q=a([row(0),{...row(1),import:-1},{...row(2),end:t+2.5*3600000},{...row(3),price:null}]);
 assert.equal(q.valid,2);assert.equal(q.priced,1);assert.equal(q.expected,4);assert.equal(q.missing,2);
});
test('empty input gives no imaginary consumption or advice',()=>{
 assert.equal(a([]).coverage,0);assert.equal(a([]).imported,0);
 assert.match(html([]),/Geen meetperiode/);assert.match(html([]),/Nog geen persoonlijk aankoopadvies/);
});
test('elapsed hours remain correct across autumn clock change',()=>{
 const rows=Array.from({length:25},(_,i)=>({...row(i),t:Date.parse('2026-10-24T22:00Z')+i*3600000,end:Date.parse('2026-10-24T22:00Z')+(i+1)*3600000}));
 assert.equal(a(rows).expected,25);assert.equal(a(rows).coverage,1);
});
