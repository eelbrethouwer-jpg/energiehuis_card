'use strict';
// PR2 fixed characterization: recorded BEFORE battery-engine extraction.
// Golden observations, not approval of inaccurate hour-level battery savings.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const golden=require('./v2/fixtures/legacy-characterization/battery-engine-v1241.json');
const code=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[]},
 customElements:{get:x=>registry.get(x),define:(x,y)=>registry.set(x,y)},
 HTMLElement:class{attachShadow(){return {addEventListener(){}};}}};
vm.runInNewContext(code+'\n;globalThis.PR2={eh20Simulate,eh21BatteryProfile,eh20Percentile};',ctx);
const engine=ctx.PR2;
const plain=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
test('PR2 baseline: is explicitly characterized historical engine, not normative',()=>{
 assert.equal(golden.type,'observed-legacy-golden');
 assert.match(golden.warning,/NOT a normative/);
 assert.equal(golden.source.baseCommit,'ee17c8879f22ccac9fe2ce9dc3415c0a971ec4e6');
});
for(const c of golden.cases){
 test('PR2 pre-extraction golden replay: '+c.name,()=>{
  const {rows,cap,roundtrip,power,mode,buy,sell,profile}=c.args;
  const before=JSON.stringify(rows);
  const result=engine.eh20Simulate(rows,cap,roundtrip,power,mode,buy,sell,profile);
  assert.deepStrictEqual(plain(result),c.expected);
  assert.equal(JSON.stringify(rows),before,'battery simulation must not mutate measured hour rows');
 });
}
for(const [i,p] of golden.profiles.entries()){
 test('PR2 pre-extraction golden profile #'+(i+1),()=>{
  assert.deepStrictEqual(plain(engine.eh21BatteryProfile(p.cap,p.config)),p.expected);
 });
}
for(const [i,p] of golden.percentiles.entries()){
 test('PR2 pre-extraction golden percentile #'+(i+1),()=>{
  assert.deepStrictEqual(plain(engine.eh20Percentile(p.values,p.q)),p.expected);
 });
}
