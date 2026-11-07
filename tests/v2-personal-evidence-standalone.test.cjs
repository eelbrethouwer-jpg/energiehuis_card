'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const engineFile=path.join(root,'src','engines','personal-evidence-engine.cjs');
const engineText=fs.readFileSync(engineFile,'utf8');
const {eh30PersonalEvidence}=require(engineFile);
const goldens=require('./v2/fixtures/personal-evidence-v1241.json');
const bundle=fs.readFileSync(path.join(root,'energiehuis-card.js'),'utf8');
const registry=new Map();
const context={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[]},customElements:{get:k=>registry.get(k),define:(k,v)=>registry.set(k,v)},
 HTMLElement:class{attachShadow(){return {addEventListener(){}};}}};
vm.runInNewContext(bundle+'\n;globalThis.PR3_EVIDENCE=eh30PersonalEvidence;',context);
const plain=v=>JSON.parse(JSON.stringify(v));
test('PR3: pure engine is independently importable without Home Assistant or browser',()=>{
 assert.deepStrictEqual(Object.keys(require(engineFile)),['eh30PersonalEvidence']);
 assert.doesNotMatch(engineText,/\bwindow\b|\bdocument\b|\blocalStorage\b|\.callService\b|\.callWS\b/);
 assert.equal(typeof context.PR3_EVIDENCE,'function');
 assert.equal((bundle.match(/function eh30PersonalEvidence\s*\(/g)||[]).length,1);
});
for(const c of goldens.cases){
 test('PR3: standalone, HACS and pre-extraction goldens agree: '+c.name,()=>{
  const original=JSON.stringify(c.rows);
  const a=plain(eh30PersonalEvidence(c.rows));
  const b=plain(context.PR3_EVIDENCE(c.rows));
  assert.deepStrictEqual(a,c.expected);
  assert.deepStrictEqual(b,c.expected);
  assert.deepStrictEqual(a,b);
  assert.equal(JSON.stringify(c.rows),original,'P1 history must remain unchanged');
 });
}
test('PR3: host CommonJS exports are preserved without clobbering older bindings',()=>{
 const host={exports:{earlier:42}};
 vm.runInNewContext(engineText,{module:host});
 assert.equal(host.exports.earlier,42);
 assert.equal(typeof host.exports.eh30PersonalEvidence,'function');
});
test('PR3: frozen host exports cannot block full HA custom-element registration',()=>{
 const frozen=Object.freeze({earlier:42});
 assert.doesNotThrow(()=>vm.runInNewContext(engineText,{module:{exports:frozen}}));
 const cards=new Map();
 const ctx={...context,module:{exports:frozen},window:{customCards:[]},
  customElements:{get:x=>cards.get(x),define:(x,y)=>cards.set(x,y)}};
 assert.doesNotThrow(()=>vm.runInNewContext(bundle,ctx));
 assert.equal(typeof cards.get('energiehuis-card'),'function');
 assert.equal(ctx.module.exports,frozen);
});
