'use strict';
// Energiehuis 3.2: zuivere kwartierprijsmotor (geen HA, geen DOM).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engines/quarter-engine.cjs');
const Q=E.EH_QT_STEP_MS;
const D0=Date.UTC(2026,10,26,0,0,0),D1=D0+86400000;
const mk=(f,n=96,from=D0)=>Array.from({length:n},(_,i)=>({t:new Date(from+i*Q).toISOString(),p:f(i)}));

test('dag: dubbele en onbekende kwartieren worden niet aangevuld, volledigheid klopt',()=>{
 const full=E.ehQtDay(mk(i=>0.2+i/1000),D0,D1);
 assert.equal(full.known,96);assert.equal(full.expected,96);assert.equal(full.complete,true);
 const part=E.ehQtDay(mk(i=>0.2,60).concat([{t:new Date(D0).toISOString(),p:9}]),D0,D1);
 assert.equal(part.known,60);assert.equal(part.complete,false);assert.equal(part.slots[0].p,0.2,'eerste waarde blijft');
 assert.equal(E.ehQtDay([{t:'x',p:1},{t:new Date(D0).toISOString(),p:'abc'},null],D0,D1).known,0);
 assert.equal(E.ehQtDay(mk(i=>1,96,D1),D0,D1).known,0,'andere dag valt erbuiten');
});

test('dag met zomer-/wintertijd telt 92 of 100 kwartieren',()=>{
 const s=Date.UTC(2026,2,28,23,0,0),e=Date.UTC(2026,2,29,22,0,0);
 assert.equal(E.ehQtDay([],s,e).expected,92);
 const s2=Date.UTC(2026,9,24,22,0,0),e2=Date.UTC(2026,9,25,23,0,0);
 assert.equal(E.ehQtDay([],s2,e2).expected,100);
});

test('statistiek: goedkoopste, duurste, gemiddelde, huidig kwartier en afwijking',()=>{
 const day=E.ehQtDay(mk(i=>i===10?0.1:i===50?0.5:0.3),D0,D1);
 const now=D0+50*Q+60000;
 const s=E.ehQtStats(day.slots,now);
 assert.equal(s.min.p,0.1);assert.equal(s.max.p,0.5);assert.equal(s.current.p,0.5);
 assert.ok(s.vsAvg>0.6&&s.vsAvg<0.7);
 assert.equal(E.ehQtStats([],now),null);
 assert.equal(E.ehQtStats(day.slots,D0-1).current,null);
});

test('venster: aaneengesloten, niet vóór nu, geen sprong over ontbrekende kwartieren',()=>{
 const day=E.ehQtDay(mk(i=>i>=20&&i<28?0.1:0.4),D0,D1);
 const w=E.ehQtWindow(day.slots,2,D0);
 assert.equal(w.start,D0+20*Q);assert.equal(w.end,D0+28*Q);assert.ok(Math.abs(w.avg-0.1)<1e-12);
 const later=E.ehQtWindow(day.slots,2,D0+40*Q);
 assert.ok(later.start>=D0+40*Q&&Math.abs(later.avg-0.4)<1e-12);
 const gap=mk(i=>0.1).filter((_,i)=>i!==5);
 const g=E.ehQtWindow(E.ehQtDay(gap,D0,D1).slots,2,D0);
 assert.ok(g.start>=D0+6*Q,'venster slaat het gat over');
 assert.equal(E.ehQtWindow(day.slots,30,D0),null);
});

test('klassen: drie lagen en een vlakke dag is middel',()=>{
 assert.equal(E.ehQtTier(0.1,0.1,0.4),'low');assert.equal(E.ehQtTier(0.25,0.1,0.4),'mid');assert.equal(E.ehQtTier(0.4,0.1,0.4),'high');
 assert.equal(E.ehQtTier(0.3,0.3,0.3),'mid');
});

test('geschiedenis: prijs geldt als stapfunctie en wordt niet teruggevuld vóór de eerste waarde',()=>{
 const m=E.ehQtPricesFromHistory([{t:D0+2*Q,p:0.2},{t:D0+6*Q,p:0.3}],D0,D0+10*Q);
 assert.equal(m.has(D0+Q),false);assert.equal(m.get(D0+2*Q),0.2);assert.equal(m.get(D0+5*Q),0.2);assert.equal(m.get(D0+6*Q),0.3);
 assert.equal(E.ehQtPricesFromHistory([],D0,D1).size,0);
 assert.equal(E.ehQtPricesFromHistory([{t:D0,p:null}],D0,D0+Q).size,0);
});

test('geschiedenis: een kwartier telt alleen met drie complete, niet-negatieve vijfminutenwaarden',()=>{
 const rows=[0,1,2].map(k=>({start:D0+k*300000,change:0.1}));
 rows.push({start:D0+Q,change:0.1},{start:D0+Q+300000,change:null},{start:D0+Q+600000,change:0.1});
 rows.push({start:D0+2*Q,change:0.1},{start:D0+2*Q+300000,change:-1},{start:D0+2*Q+600000,change:0.1});
 const m=E.ehQtSumQuarters(rows,D0,D0+4*Q);
 assert.ok(Math.abs(m.get(D0)-0.3)<1e-12);assert.equal(m.has(D0+Q),false,'ontbrekende bucket');assert.equal(m.has(D0+2*Q),false,'teller-reset');
 assert.equal(m.has(D0+3*Q),false);
});

test('kosten: saldering tot en met 2026, daarna alleen met bekende vergoeding; afronding sluit exact',()=>{
 const start=D0,end=D0+4*Q;
 const price=new Map([[D0,0.3],[D0+Q,0.3],[D0+2*Q,0.3]]);
 const imp=new Map([[D0,1],[D0+Q,0.5],[D0+2*Q,0]]),exp=new Map([[D0,0],[D0+Q,0.2],[D0+2*Q,1]]);
 const r=E.ehQtCostDay(price,imp,exp,start,end,{salderingEndMs:Date.UTC(2026,11,31,23,0,0),feedin:null});
 assert.equal(r.expected,4);assert.equal(r.total.complete,3);
 assert.ok(Math.abs(r.total.netto-(0.3*1+0.3*0.5-0.3*0.2-0.3*1))<1e-12);
 assert.equal(r.rows[3].complete,false);
 const y27=Date.UTC(2027,0,1,0,0,0);
 const p27=new Map([[y27,0.3]]),i27=new Map([[y27,1]]),e27=new Map([[y27,2]]);
 const none=E.ehQtCostDay(p27,i27,e27,y27,y27+Q,{salderingEndMs:Date.UTC(2026,11,31,23,0,0),feedin:null});
 assert.equal(none.total.nettoKnown,false);assert.equal(none.rows[0].netto,null);assert.ok(Math.abs(none.total.afname-0.3)<1e-12);
 const known=E.ehQtCostDay(p27,i27,e27,y27,y27+Q,{salderingEndMs:Date.UTC(2026,11,31,23,0,0),feedin:0.1});
 assert.equal(known.total.nettoKnown,true);assert.ok(Math.abs(known.total.netto-(0.3-0.2))<1e-12);
});

test('motor is zuiver: geen HA, DOM, opslag of netwerk',()=>{
 const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','src','engines','quarter-engine.cjs'),'utf8');
 assert.doesNotMatch(src,/\bdocument\b|\bwindow\b|localStorage|fetch\(|callWS|callService|hass/);
});
