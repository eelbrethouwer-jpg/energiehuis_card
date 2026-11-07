'use strict';
// PR3 legacy characterization captured on main c22eabd before any evidence-engine extraction.
// These observations are invariants, not proof of economical or physical correctness.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const golden=require('./v2/fixtures/personal-evidence-v1241.json');
const code=fs.readFileSync(path.join(root,'energiehuis-card.js'),'utf8');
const registry=new Map();
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[]},customElements:{get:k=>registry.get(k),define:(k,v)=>registry.set(k,v)},
 HTMLElement:class{attachShadow(){return {addEventListener(){}};}}};
vm.runInNewContext(code+'\n;globalThis.PERSONAL_EVIDENCE=eh30PersonalEvidence;',ctx);
const plain=v=>JSON.parse(JSON.stringify(v));
test('PR3: characterization is pre-extraction evidence, not a normative model',()=>{
 assert.equal(golden.type,'observed-legacy-golden');
 assert.equal(golden.source.baseCommit,'c22eabd4310288136d08d60c1f46258fa6e58102');
 assert.equal(golden.source.legacyBlobSha,'abf33ba2748bfa2db6e059ef9a0a8fd4b490f8ee');
 assert.equal(golden.cases.length,13);
});
for(const entry of golden.cases){
 test('PR3: pre-extraction evidence golden '+entry.name,()=>{
  const before=JSON.stringify(entry.rows);
  const actual=plain(ctx.PERSONAL_EVIDENCE(entry.rows));
  assert.deepStrictEqual(actual,entry.expected);
  assert.equal(JSON.stringify(entry.rows),before,'input must remain unchanged');
 });
}
