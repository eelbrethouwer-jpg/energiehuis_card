const test=require('node:test'),assert=require('node:assert/strict');
const {eh20Simulate}=require('../src/engines/battery-engine.cjs');
test('piekregeling spaart energie voor dure uren en begrenst de extra netafname',()=>{
 const rows=Array.from({length:24},(_,h)=>{
  const t=new Date(2026,0,2,h).getTime();
  return {t,end:t+3600000,price:h<4?.1:h>=20?.6:.3,import:h===0?9:2,export:h===0?0:h===1?1:0};
 });
 const r=eh20Simulate(rows,10,1,3,'peak',.25,.05);
 assert.ok(Math.abs(r.points[0].chargedGrid-.2)<1e-9);
 assert.equal(r.points[1].chargedSolar,1);
 assert.equal(r.points[1].chargedGrid,0);
 assert.ok(r.points.slice(0,20).every(p=>p.discharged===0));
 assert.ok(r.points[20].discharged>0);
 assert.ok(Math.abs(r.savings-(r.served*.6-r.gridCharge*.1-.05))<1e-8);
 rows[5].price=null;assert.equal(eh20Simulate(rows,10,1,3,'peak',.25,.05),null);
});
