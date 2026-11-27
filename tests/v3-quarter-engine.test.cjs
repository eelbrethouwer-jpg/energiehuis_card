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

test('weer: eenheden naar m/s, bewolking uit waarde of conditie, dagen zonder dubbelen vanaf vandaag',()=>{
 assert.equal(E.ehWxMs(36,'km/h'),10);assert.equal(E.ehWxMs(10,'m/s'),10);assert.ok(Math.abs(E.ehWxMs(10,'mph')-4.4704)<1e-9);assert.equal(E.ehWxMs(-1,'km/h'),null);assert.equal(E.ehWxMs('x'),null);
 assert.equal(E.ehWxCloud({cloud_coverage:140}),100);assert.equal(E.ehWxCloud({condition:'sunny'}),10);assert.equal(E.ehWxCloud({condition:'raar'}),null);
 const key=ms=>new Date(ms).toISOString().slice(0,10),now=Date.UTC(2026,10,26,12);
 const d=E.ehWxDays([{datetime:'2026-11-25T12:00:00Z',wind_speed:10},{datetime:'2026-11-26T12:00:00Z',wind_speed:36,temperature:6,templow:2,condition:'cloudy'},{datetime:'2026-11-26T18:00:00Z',wind_speed:99},{datetime:'2026-11-27T12:00:00Z',wind_speed:7.2,cloud_coverage:20}],now,'km/h',key);
 assert.equal(d.length,2);assert.equal(d[0].wind,10);assert.equal(d[0].temp,4);assert.equal(d[0].cloud,90);assert.equal(d[1].cloud,20);
 assert.deepEqual(E.ehWxDays(null,now,'km/h',key),[]);
});

test('weer: indicatie geeft redenen; wind en zon wijzen naar goedkoper, windstil en koud naar duurder',()=>{
 assert.equal(E.ehWxIndication({wind:9,cloud:50,temp:8},10).level,'cheaper');
 assert.deepEqual(E.ehWxIndication({wind:9,cloud:50,temp:8},10).reasons,['veel wind']);
 assert.equal(E.ehWxIndication({wind:2,cloud:95,temp:0},0).level,'pricier');
 assert.equal(E.ehWxIndication({wind:5,cloud:50,temp:8},5).level,'average');
 assert.equal(E.ehWxIndication({wind:5,cloud:10,temp:20},5).level,'average','zon alleen is nog geen duidelijk signaal');
 assert.equal(E.ehWxIndication({wind:8,cloud:10,temp:20},5).level,'cheaper');
 assert.equal(E.ehWxIndication({wind:null,cloud:null,temp:null},5).level,'average');
 assert.equal(E.ehWxIndication({wind:5,cloud:10,temp:20},11).score,0,'zon telt alleen in het zomerhalfjaar');
});

test('terugblik: dagen uit weergeschiedenis en beoordeling alleen op duidelijke signalen',()=>{
 const key=ms=>new Date(ms).toISOString().slice(0,10),D=n=>Date.UTC(2026,10,10+n,12);
 const h=E.ehWxHistoryDays([{t:D(0),wind:10,cloud:null,temp:4},{t:D(0)+3600000,wind:8,cloud:50,temp:6},{t:D(1),wind:2,cloud:90,temp:1},{t:NaN,wind:99}],key);
 assert.equal(h.length,2);assert.equal(h[0].wind,9);assert.equal(h[0].cloud,50);assert.equal(h[0].temp,5);
 const days=[{dayKey:'a',t:D(0),wind:10,cloud:50,temp:6,avg:0.20},{dayKey:'b',t:D(1),wind:2,cloud:90,temp:5,avg:0.40},{dayKey:'c',t:D(2),wind:5,cloud:50,temp:6,avg:0.30},{dayKey:'d',t:D(3),wind:9,cloud:50,temp:6,avg:0.35},{dayKey:'e',t:D(4),wind:5,cloud:50,temp:6,avg:null}];
 const r=E.ehWxBacktest(days,ms=>new Date(ms).getUTCMonth());
 assert.equal(r.priced,4);assert.ok(Math.abs(r.ref-0.3125)<1e-12);
 assert.equal(r.signals,3);assert.equal(r.hits,2,'a goedkoper klopt, b duurder klopt, d (veel wind, +12%) klopt niet');
 assert.equal(r.rows.find(x=>x.dayKey==='c').hit,null);
 assert.deepEqual(E.ehWxBacktest([],()=>0),{rows:[],priced:0,signals:0,hits:0,ref:null});
});

test('motor is zuiver: geen HA, DOM, opslag of netwerk',()=>{
 const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','src','engines','quarter-engine.cjs'),'utf8');
 assert.doesNotMatch(src,/\bdocument\b|\bwindow\b|localStorage|fetch\(|callWS|callService|hass/);
});
