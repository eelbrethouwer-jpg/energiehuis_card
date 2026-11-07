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

test('PR2: getal-parser behoudt exacte eh17N-semantiek op grensgevallen',()=>{
 const original=fs.readFileSync(path.join(root,'src','legacy','03-energy-intelligence.js'),'utf8');
 const engine=fs.readFileSync(path.join(root,'src','engines','battery-engine.cjs'),'utf8');
 const helper=original.match(/function eh17N\(v\)\{[^\r\n]+\}/)?.[0];
 assert.ok(helper,'Originele eh17N helper ontbreekt');
 const context={};
 vm.runInNewContext(helper+'\n'+engine+'\n;globalThis.NUMBER_CHECK={eh17N,ehBatteryNumber};',context);
 const {eh17N,ehBatteryNumber}=context.NUMBER_CHECK;
 const cases=[
  null,undefined,'',0,-0,1,-1,.25,-.25,7,999,-999,1e-12,-1e-12,1e12,
  Number.MAX_VALUE,Number.MIN_VALUE,Infinity,-Infinity,NaN,true,false,
  '0','-0','0,25','1,23','-4,4','5.7',' 2 ','\t',' ','1e3','1e309','abc',
  '0x10','0b11','12,345','1.234,5','a,b','--1','1,2,3','Infinity','NaN',
  [],[1],[1,2],{},new Number(3),new String('4,5'),-0.0,0.1+0.2,
  9007199254740991,9007199254740992,Symbol('invalid'),1n,
  {valueOf(){return 4;}},{toString(){return '2,25';}},
  {toString(){throw Error('test sentinel');}}
 ];
 assert.ok(cases.length>=51);
 for(const value of cases){
  let a,b,ea=null,eb=null;
  try{a=eh17N(value)}catch(err){ea=err.name+':'+err.message}
  try{b=ehBatteryNumber(value)}catch(err){eb=err.name+':'+err.message}
  assert.equal(eb,ea,'Parser error differs for '+String(value instanceof Object?'object':value));
  if(ea===null)assert.ok(Object.is(a,b),'Parser output differs for '+String(value instanceof Object?'object':value));
 }
});
test('PR2: export naar bestaande host-module behoudt oudere exports',()=>{
 const engine=fs.readFileSync(path.join(root,'src','engines','battery-engine.cjs'),'utf8');
 const host={exports:{previousFunction:42}};
 vm.runInNewContext(engine,{module:host});
 assert.equal(host.exports.previousFunction,42);
 for(const name of ['eh20Simulate','eh21BatteryProfile','eh20Percentile'])assert.equal(typeof host.exports[name],'function');
});

test('PR2: bevroren host-exports laten kaartregistratie en engine intact',()=>{
 const engine=fs.readFileSync(path.join(root,'src','engines','battery-engine.cjs'),'utf8');
 const frozen=Object.freeze({previousFunction:42});
 assert.doesNotThrow(()=>vm.runInNewContext(engine,{module:{exports:frozen}}));
 assert.equal(frozen.previousFunction,42);
 assert.deepEqual(Object.keys(frozen),['previousFunction']);
 const registry=new Map();
 const sandbox={...ctx,
  module:{exports:frozen},window:{customCards:[]},
  customElements:{get:k=>registry.get(k),define:(k,v)=>registry.set(k,v)}
 };
 assert.doesNotThrow(()=>vm.runInNewContext(source,sandbox));
 assert.equal(typeof registry.get('energiehuis-card'),'function');
 assert.equal(sandbox.module.exports,frozen);
});
