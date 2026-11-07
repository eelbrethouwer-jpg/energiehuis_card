'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const {eh20Percentile,eh21BatteryProfile,eh20Simulate}=require('../src/engines/battery-engine.cjs');
const golden=require('./v2/fixtures/legacy-characterization/battery-engine-v1241.json');
const plain=o=>o===undefined?o:JSON.parse(JSON.stringify(o));
const source=fs.readFileSync(path.join(root,'energiehuis-card.js'),'utf8');
const registry=new Map();
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[]},customElements:{get:k=>registry.get(k),define:(k,v)=>registry.set(k,v)},
 HTMLElement:class{attachShadow(){return {addEventListener(){}};}}};
vm.runInNewContext(source+'\n;globalThis.BATTERY_ENGINE={eh20Percentile,eh21BatteryProfile,eh20Simulate};',ctx);
const embedded=ctx.BATTERY_ENGINE;
test('PR2: standalone import werkt zonder HA, browser globals of netwerk',()=>{
 assert.deepEqual(Object.keys(require('../src/engines/battery-engine.cjs')).sort(),
  ['eh20Percentile','eh20Simulate','eh21BatteryProfile'].sort());
 const engine=fs.readFileSync(path.join(root,'src','engines','battery-engine.cjs'),'utf8');
 assert.doesNotMatch(engine,/\bwindow\b|\bdocument\b|\blocalStorage\b|\bcustomElements\b|\.callService\b|\.callWS\b/);
});
for(const c of golden.cases){
 test('PR2: standalone/embedded/golden parity: '+c.name,()=>{
  const a=c.args,params=[a.rows,a.cap,a.roundtrip,a.power,a.mode,a.buy,a.sell,a.profile];
  const inputs=JSON.stringify(a.rows);
  const result=plain(eh20Simulate(...params)),inCard=plain(embedded.eh20Simulate(...params));
  assert.deepStrictEqual(result,c.expected,'portable engine differs from pre-extraction baseline');
  assert.deepStrictEqual(inCard,c.expected,'HACS runtime differs from original baseline');
  assert.deepStrictEqual(result,inCard);
  assert.equal(JSON.stringify(a.rows),inputs,'no mutated historical P1 data');
 });
}
for(const [i,p] of golden.profiles.entries()){
 test('PR2: standalone/embedded profile golden '+i,()=>{
  assert.deepStrictEqual(plain(eh21BatteryProfile(p.cap,p.config)),p.expected);
  assert.deepStrictEqual(plain(embedded.eh21BatteryProfile(p.cap,p.config)),p.expected);
 });
}
for(const [i,p] of golden.percentiles.entries()){
 test('PR2: standalone/embedded percentile golden '+i,()=>{
  assert.deepStrictEqual(eh20Percentile(p.values,p.q),p.expected);
  assert.deepStrictEqual(embedded.eh20Percentile(p.values,p.q),p.expected);
 });
}
test('PR2: de drie legacy API-symbolen bestaan eenmaal als functie in de kaart',()=>{
 for(const symbol of ['eh20Simulate','eh21BatteryProfile','eh20Percentile']){
  assert.equal((source.match(new RegExp('function '+symbol+'\\s*\\(','g'))||[]).length,1,symbol);
  assert.equal(typeof embedded[symbol],'function');
 }
});
