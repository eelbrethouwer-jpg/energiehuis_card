'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const f=require('./fixtures/normative/core.json');
const near=(actual,expected,tol=1e-9)=>assert.ok(Math.abs(actual-expected)<tol,actual+' != '+expected);
test('PR0 normative: fixtures are explicitly synthetic, not production claims',()=>{
 assert.equal(f.type,'normative');assert.match(f.provenance,/SYNTHETIC/);
});
test('PR0 E1: wall energy and EV cost include charging losses',()=>{
 const x=f.chargeLoss,wall=x.batteryKwh/x.efficiency;
 near(wall,x.wallKwh);near(wall*x.priceEurPerWallKwh,x.costEur);
 near(x.batteryKwh*x.priceEurPerWallKwh,x.naiveWithoutLossEur);
 assert.ok(x.costEur>x.naiveWithoutLossEur);
});
test('PR0 E4: price must be weighted by measured interval consumption',()=>{
 const x=f.weightedContract;
 const total=x.intervals.reduce((s,i)=>s+i.importKwh*i.priceEurPerKwh,0);
 const average=x.intervals.reduce((s,i)=>s+i.priceEurPerKwh,0)/x.intervals.length;
 const naive=x.intervals.reduce((s,i)=>s+i.importKwh,0)*average;
 near(total,x.correctEur);near(naive,x.incorrectAverageEur);assert.notEqual(total,naive);
});
test('PR0: negative export remuneration is a charge, not a free credit',()=>{
 const x=f.negativeExport;near(-x.exportKwh*x.exportPriceEurPerKwh,x.netChargeEur);
});
test('PR0 E4: residual threshold requires independent aligned meters',()=>{
 const x=f.residual;
 const residual=parts=>Math.abs(parts.reduce((sum,v)=>sum+v,0)-x.p1Kwh);
 assert.ok(residual(x.acceptedIndependentPartsKwh)<=x.toleranceKwh);
 assert.ok(residual(x.rejectedIndependentPartsKwh)>x.toleranceKwh);
 assert.equal(x.requiresIndependentMeters,true);
});
test('PR0 E3: unpriced intervals remain unknown; no unvalidated price band',()=>{
 const x=f.unknownPrice;
 assert.equal(x.intervals[0].priceEurPerKwh,null);
 assert.equal(x.allowZeroFill,false);assert.equal(x.allowUnvalidatedPredictionBand,false);
});
test('PR0 E5: provenance measured and quality stale remain independent',()=>{
 const x=f.quality;assert.equal(x.provenance,'measured');assert.equal(x.quality,'stale');
 assert.equal(x.currentSafeChargingChoiceAllowed,false);
});
