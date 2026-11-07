'use strict';
// Observed v1.24.1 behaviour, not normative design requirements for v2.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const f=require('./fixtures/legacy-characterization/v1241.json');
const src=fs.readFileSync(path.join(__dirname,'..','..','energiehuis-card.js'),'utf8');
const registry=new Map();
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,Intl,
 window:{customCards:[]},customElements:{get:k=>registry.get(k),define:(k,v)=>registry.set(k,v)},
 HTMLElement:class{attachShadow(){return {addEventListener(){}};}}};
vm.runInNewContext(src+'\n;globalThis.PR0_LEGACY={eh17Plan,eh20Simulate,ehCompareCalculate,ehCompareContract};',ctx);
const engine=ctx.PR0_LEGACY;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9, a+' != '+b);
test('PR0 legacy: fixture is explicitly observation rather than v2 normative target',()=>{
 assert.equal(f.type,'legacy-characterization');assert.match(f.warning,/not normative/);
});
test('PR0 legacy: current planner includes wall loss and chooses cheapest hour',()=>{
 const x=f.planner;
 const r=engine.eh17Plan(x.prices,new Date(x.nowUtc),x.departureUtc,x.batteryNeedKwh,x.requestedKw,x.mode,x.opts);
 assert.equal(r.error,null);near(r.totalKwh,x.expected.totalKwh);near(r.remaining,x.expected.remainingKwh);
 near(r.cost,x.expected.costEur);near(r.allowedKw,x.expected.allowedKw);
 assert.equal(r.selected.length,1);assert.equal(new Date(r.selected[0].t).toISOString(),new Date(x.expected.selectedUtc).toISOString());
 near(r.selected[0].wallKwh,x.batteryNeedKwh/x.opts.efficiency);
});
test('PR0 legacy: existing solar replay result is a characterization',()=>{
 const x=f.battery,rows=x.rows.map(r=>({...r,t:Date.parse(r.t),end:Date.parse(r.end)}));
 const r=engine.eh20Simulate(rows,x.capacityKwh,x.roundtrip,x.powerKw,x.mode,x.assumedBuyEurKwh,x.assumedSellEurKwh);
 near(r.pvCharge,x.expected.pvChargeKwh);near(r.served,x.expected.servedKwh);
 near(r.endingSoc,x.expected.endingSocKwh);near(r.savings,x.expected.savingsEur);
 assert.equal(r.assumedPrices,x.expected.assumedPrices);
});
test('PR0 legacy: weighted dynamic contract is characterized with complete synthetic prices',()=>{
 const x=f.contract,from=new Date(x.fromUtc),to=new Date(x.untilUtc),rows=x.rows.map(r=>({...r,t:Date.parse(r.t)}));
 const contract=engine.ehCompareContract({id:'pr0-fixture',name:'Fictief',type:'dynamic',
  settlement:'separate',priceEntity:'sensor.fixture',buy:0,sell:0,daily:0,exportFee:0,reference:true});
 const prices={'sensor.fixture':new Map(rows.map((r,i)=>[r.t,x.prices[i]]))};
 const result=engine.ehCompareCalculate([contract],rows,prices,{from,to,days:1});
 assert.equal(result.complete,true);near(result.imported,x.expected.importKwh);
 near(result.exported,x.expected.exportKwh);near(result.reference.total,x.expected.totalEur);
});
