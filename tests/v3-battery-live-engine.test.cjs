'use strict';
// Live batterijdashboard: zuivere motor (geen HA, geen DOM).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engines/battery-live-engine.cjs');
const H=E.EH_BL_HOUR_MS,T0=Date.UTC(2026,10,28,0,0);

test('vermogen: laden is positief, ontladen negatief, op basis van de laatste 30 minuten',()=>{
 const up=[{t:T0,v:5},{t:T0+10*60000,v:5.1},{t:T0+20*60000,v:5.2}];
 const a=E.ehBlDerivePower(up,T0+21*60000);
 assert.ok(Math.abs(a.watts-600)<1e-6);assert.equal(a.spanMin,20);assert.equal(a.staleMin,1);
 const down=[{t:T0,v:5},{t:T0+30*60000,v:4.5}];
 assert.ok(Math.abs(E.ehBlDerivePower(down,T0+31*60000).watts+1000)<1e-6);
});

test('vermogen: zonder twee punten, te grote gaten of ongeldige waarden is het onbekend, nooit 0 W',()=>{
 assert.equal(E.ehBlDerivePower([],T0),null);
 assert.equal(E.ehBlDerivePower([{t:T0,v:5}],T0+1000),null);
 assert.equal(E.ehBlDerivePower([{t:T0,v:5},{t:T0+3*H,v:6}],T0+3*H),null,'gat > 2 uur');
 assert.equal(E.ehBlDerivePower([{t:T0,v:'unknown'},{t:T0+H/2,v:'x'}],T0+H),null);
 assert.equal(E.ehBlDerivePower([{t:T0,v:5},{t:T0+30000,v:5.1}],T0+60000),null,'minder dan een minuut');
 const sparse=E.ehBlDerivePower([{t:T0,v:5},{t:T0+H,v:5.5}],T0+H+10*60000);
 assert.ok(Math.abs(sparse.watts-500)<1e-6);assert.equal(sparse.spanMin,60);
});

test('dagtotalen: geladen en ontladen apart; resets en gaten maken het onvolledig en tellen niet mee',()=>{
 const pts=[{t:T0,v:2},{t:T0+H,v:3},{t:T0+2*H,v:2.5},{t:T0+3*H,v:4}];
 const d=E.ehBlDayTotals(pts,T0,T0+4*H);
 assert.ok(Math.abs(d.charged-2.5)<1e-12);assert.ok(Math.abs(d.discharged-0.5)<1e-12);assert.equal(d.complete,true);
 const reset=E.ehBlDayTotals([{t:T0,v:2},{t:T0+H,v:9},{t:T0+2*H,v:9.5}],T0,T0+3*H,{maxStepKwh:6});
 assert.equal(reset.complete,false);assert.ok(Math.abs(reset.charged-0.5)<1e-12);
 const gap=E.ehBlDayTotals([{t:T0,v:2},{t:T0+5*H,v:3}],T0,T0+6*H);
 assert.equal(gap.complete,false);assert.equal(gap.charged,0);
 assert.deepEqual(E.ehBlDayTotals([],T0,T0),{charged:0,discharged:0,complete:false,steps:0});
});

test('per uur: stapfunctie, onbekend vóór de eerste stand en geen aanvulling met latere waarden',()=>{
 const h=E.ehBlHourly([{t:T0+2*H+5000,v:50},{t:T0+5*H,v:70}],T0,T0+7*H);
 assert.equal(h.length,7);assert.equal(h[0].v,null);assert.equal(h[1].v,null);assert.equal(h[2].v,50);assert.equal(h[4].v,50);assert.equal(h[5].v,70);assert.equal(h[6].v,70);
});

test('resterende tijd, stand en niveau',()=>{
 assert.deepEqual(E.ehBlTimeTo(5,10,1000),{to:'full',minutes:300});
 assert.deepEqual(E.ehBlTimeTo(5,10,-2500),{to:'empty',minutes:120});
 assert.equal(E.ehBlTimeTo(5,10,5),null);assert.equal(E.ehBlTimeTo(NaN,10,500),null);assert.equal(E.ehBlTimeTo(11,10,500),null);
 assert.equal(E.ehBlMode(500),'charging');assert.equal(E.ehBlMode(-500),'discharging');assert.equal(E.ehBlMode(10),'idle');assert.equal(E.ehBlMode(null),'unknown');
 assert.equal(E.ehBlLevel(97),'full');assert.equal(E.ehBlLevel(50),'good');assert.equal(E.ehBlLevel(20),'low');assert.equal(E.ehBlLevel(3),'empty');assert.equal(E.ehBlLevel(NaN),'unknown');
 assert.equal(E.ehBlCapacity(6,60,10),10);assert.ok(Math.abs(E.ehBlCapacity(3,20,10)-15)<1e-12);assert.equal(E.ehBlCapacity(0.2,2,10),10,'te lage SOC geeft geen capaciteit');
});

test('motor is zuiver: geen HA, DOM, opslag of netwerk',()=>{
 const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','src','engines','battery-live-engine.cjs'),'utf8');
 assert.doesNotMatch(src,/\bdocument\b|\bwindow\b|localStorage|fetch\(|callWS|callService|hass/);
});
