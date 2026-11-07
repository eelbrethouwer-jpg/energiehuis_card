'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const x=require('./fixtures/counterexamples/ev-quarter-aliasing.json');
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,a+' != '+b);
const net=r=>r.house+r.ev-r.pv;
const homeNet=r=>r.house-r.pv;
const sum=(a,key)=>a.reduce((s,r)=>s+(key?r[key]:r),0);
// An intentionally small independent reference: PV charges, house-only net load discharges.
// Quarter inputs are independent synthetic component readings, not reconstructed from P1.
function reference(rows){
 let soc=x.startSocKwh,saving=0,charged=0,discharged=0;
 const maxEnergy=x.maxChargeKw*x.durationHours;
 for(const q of rows){
  const h=homeNet(q);
  if(h>0){const used=Math.min(h,x.maxDischargeKw*x.durationHours,soc);soc-=used;discharged+=used;saving+=used*x.buyEurPerKwh;}
  else if(h<0){const use=Math.min(-h,maxEnergy,x.capacityKwh-soc);soc+=use;charged+=use;saving-=use*x.sellEurPerKwh;}
 }
 return {saving,soc,charged,discharged};
}
test('PR0 E7: distinct component profiles produce exactly identical P1 quarter readings',()=>{
 assert.equal(x.type,'counterexample');
 const a=x.A.map(net),b=x.B.map(net);
 assert.deepEqual(a,x.expected.identicalP1QuarterNetKwh);assert.deepEqual(b,a);
 near(sum(a),x.expected.p1HourImportKwh);near(sum(x.A,'ev'),x.expected.evHourKwh);
 near(sum(b)-sum(x.B,'ev'),x.expected.naiveHouseNetHourKwh);
});
test('PR0 E7: battery outcome differs even though P1 is identical (constructive proof)',()=>{
 const a=reference(x.A),b=reference(x.B);
 near(a.saving,x.expected.batterySavingsA);near(b.saving,x.expected.batterySavingsB);
 near(a.soc,x.expected.endingSocKwh);near(b.soc,x.expected.endingSocKwh);
 assert.notEqual(a.saving,b.saving);assert.equal(x.expected.conclusion,'not-identifiable-from-p1-hour-alone');
});
test('PR0 E7/E4: exact EV exclusion needs independent aligned sensors and numerical residual',()=>{
 const classify=(independent,alignedMinutes,residual)=>independent&&alignedMinutes<=5&&Math.abs(residual)<=0.01?'reconstructed':'estimated';
 assert.equal(classify(true,5,0.009),'reconstructed');
 assert.equal(classify(true,5,0.021),'estimated');
 assert.equal(classify(false,5,0),'estimated','Circular P1-based values are not independent');
 assert.equal(classify(true,60,0),'estimated','Hour averages cannot establish quarter ordering');
});
