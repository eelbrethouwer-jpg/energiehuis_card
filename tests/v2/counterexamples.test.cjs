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
function reference(rows,roundtrip=x.roundtripEfficiency){
 let soc=x.startSocKwh,saving=0,charged=0,discharged=0;
 assert.ok(roundtrip>0&&roundtrip<=1);
 const eta=Math.sqrt(roundtrip);
 const chargeLimit=x.maxChargeKw*x.durationHours,dischargeLimit=x.maxDischargeKw*x.durationHours;
 for(const q of rows){
  const h=homeNet(q);
  if(h>0){
   const used=Math.max(0,Math.min(h,dischargeLimit,soc*eta));
   soc-=used/eta;discharged+=used;saving+=used*x.buyEurPerKwh;
  }else if(h<0){
   const input=Math.max(0,Math.min(-h,chargeLimit,(x.capacityKwh-soc)/eta));
   soc+=input*eta;charged+=input;saving-=input*x.sellEurPerKwh;
  }
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
 // Both meter profiles have one hourly import and one hourly EV charge;
 // net-zero reconstructed house load incorrectly implies no battery benefit.
 const p1HourKwh=sum(x.A.map(net)),evHourKwh=sum(x.A,'ev');
 const naiveHomeHourNetKwh=p1HourKwh-evHourKwh;
 near(naiveHomeHourNetKwh,x.expected.naiveHouseNetHourKwh);
 const naiveHourlySavings=naiveHomeHourNetKwh===0?0:NaN;
 near(naiveHourlySavings,a.saving);
 near(b.saving-naiveHourlySavings,0.25);
 assert.notEqual(a.saving,b.saving);assert.equal(x.expected.conclusion,'not-identifiable-from-p1-hour-alone');
});
test('PR0 E7/E4: exact EV exclusion needs independent aligned sensors and numerical residual',()=>{
 // Residual: exact hourly energy balance in *integer Wh* to avoid float boundary errors.
 // Aligned 5-minute component sensors are necessary but not proof of sub-hour ordering.
 const toWh=kwh=>Math.round(kwh*1000);
 const classify=(independent,alignedMinutes,p1Kwh,parts)=>{
  if(!independent||alignedMinutes>5)return 'estimated';
  const residualWh=Math.abs(toWh(p1Kwh)-sum(parts.map(toWh)));
  return residualWh<=10?'reconstructed':'estimated';
 };
 assert.equal(classify(true,5,1,[0.5,0.49]),'reconstructed','10 Wh is included');
 assert.equal(classify(true,5,1,[0.5,0.489]),'estimated','11 Wh is excluded');
 assert.equal(toWh(0.4905),491,'1 Wh integer resolution, round 490.5 Wh to 491 Wh');
 assert.equal(classify(true,5,1,[0.5,0.4905]),'reconstructed');
 assert.equal(classify(false,5,1,[0.5,0.5]),'estimated','Derived from P1 is not independent');
 assert.equal(classify(true,60,1,[0.5,0.5]),'estimated','Hourly meters do not prove quarter timing');
});
test('PR0 E7: quarter-hour reference applies configured charging and discharge losses',()=>{
 const ideal=reference(x.B),lossy=reference(x.B,x.expected.lossyRoundtripEfficiency);
 near(ideal.saving,x.expected.batterySavingsB);
 near(lossy.saving,x.expected.lossySavingsB);
 near(lossy.soc,x.expected.lossyEndingSocKwh);
 assert.ok(lossy.saving<ideal.saving,'Roundtrip losses reduce achievable savings');
 assert.ok(lossy.soc<ideal.soc,'Roundtrip losses reduce ending SOC');
});
