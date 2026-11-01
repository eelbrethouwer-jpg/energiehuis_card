'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[],navigator:{onLine:true}},
 customElements:{get:n=>registry.get(n),define:(n,x)=>registry.set(n,x)},
 HTMLElement:class{attachShadow(){return {addEventListener(){}};}}};
vm.runInNewContext(src+'\n;globalThis.EH_CUPRA_TEST={EnergiehuisCard,ehCupraSegments};',ctx);
const {EnergiehuisCard,ehCupraSegments}=ctx.EH_CUPRA_TEST;

function createFixture(){
 const now=new Date();
 const oldA=new Date('2025-09-20T09:00:00Z').getTime();
 const oldB=new Date('2025-09-20T12:00:00Z').getTime();
 const recentA=now.getTime()-2*60*60*1000;
 const recentB=now.getTime()-60*60*1000;
 const c={
  cupra:'sensor.cupra_soc',cupra_mileage:'sensor.cupra_mileage',cupra_range:'sensor.cupra_range',
  cupra_outside_temp:'sensor.cupra_temp',cupra_target_temp:'sensor.cupra_target',
  cupra_climate_usage:'sensor.cupra_climate',cupra_onboard_usage:'sensor.cupra_board',
  laad_energie:'sensor.alfen_energy',cupra_usable_kwh:59,cupra_refresh_minutes:15
 };
 const points=(values)=>[oldA,oldB,recentA,recentB].map((t,i)=>({lu:Math.floor(t/1000),s:String(values[i])}));
 const history={
  [c.cupra_mileage]:points([1000,1020,2000,2020]),
  [c.cupra]:points([82,76,80,74]),
  [c.cupra_outside_temp]:points([8,8,16,16]),
  [c.cupra_range]:points([260,240,280,260]),
  [c.cupra_target_temp]:points([20,20,20,20]),
  [c.laad_energie]:points([15,15,15,15])
 };
 const calls=[];
 const hass={states:{},callWS:async req=>{
  calls.push(req);
  if(req.type==='history/history_during_period')return history;
  if(req.type==='recorder/statistics_during_period')return {};
  throw Error('Unexpected Home Assistant WS request: '+req.type);
 }};
 const card=Object.create(EnergiehuisCard.prototype);
 Object.assign(card,{
  _hass:hass,config:c,_view:'cupra',_cupraInsightsPeriod:'year',
  _cupraInsightsCache:new Map(),_cupraInsightsLoadingKey:null,_cupraInsightsResult:null,
  _cupraAllHistoryCache:null,_cupraAllHistoryPending:null,
  _schedule:()=>{}
 });
 return {card,c,hass,history,calls,now};
}
test('historische analyse neemt oude en nieuwe geldige ritten mee',async()=>{
 const {card}=createFixture();
 await card._loadCupraInsights();
 const r=card._cupraInsightsResult;
 assert.equal(r.period,'year');
 assert.equal(r.metrics.valid.length,2,'een rit uit 2025 en een rit uit de huidige periode');
 assert.equal(r.metrics.km,40);
 assert.equal(r.tempGroups.find(g=>g.label==='5–10°C').count,1);
 assert.equal(r.tempGroups.find(g=>g.label==='15–20°C').count,1);
 assert.ok(Number.isFinite(r.metrics.kwh100));
});
test('periodewissel beïnvloedt kilometers maar nooit efficiëntie of temperatuurklassen',async()=>{
 const {card,calls}=createFixture();
 await card._loadCupraInsights();
 const year=card._cupraInsightsResult;
 card._cupraInsightsPeriod='today';
 await card._loadCupraInsights();
 const today=card._cupraInsightsResult;
 assert.equal(today.period,'today');
 assert.equal(today.metrics.range,year.metrics.range);
 assert.equal(today.metrics.kwh100,year.metrics.kwh100);
 assert.equal(today.metrics.valid.length,year.metrics.valid.length);
 assert.deepEqual(JSON.parse(JSON.stringify(today.tempGroups)),JSON.parse(JSON.stringify(year.tempGroups)));
 assert.equal(calls.filter(c=>c.type==='history/history_during_period').length,1,'geen tweede zware historiequery bij periodewissel');
 assert.equal(calls.filter(c=>c.type==='recorder/statistics_during_period').length,2,'periode-statistieken mogen apart worden geladen');
});
test('volledige detailhistorie wordt zonder geselecteerde periodegrens opgevraagd',async()=>{
 const {card,calls}=createFixture();
 await card._loadCupraInsights();
 const q=calls.find(c=>c.type==='history/history_during_period');
 assert.ok(q);
 assert.equal(q.start_time,'2020-01-01T00:00:00.000Z');
 assert.notEqual(q.start_time,card._cupraInsightsResult.limits.from.toISOString());
 assert.equal(q.significant_changes_only,false);
});
test('meetgaten van maanden leveren geen onterecht ritsegment op',()=>{
 const {c,hass,history,now}=createFixture();
 const result=ehCupraSegments(history,c,hass,new Date('2020-01-01'),now,59);
 assert.equal(result.segments.filter(s=>s.valid).length,2);
 assert.equal(result.segments.length,2,'sprong over een jaar wordt niet als rit beschouwd');
});
test('gebruikersinterface vermeldt expliciet de historische reikwijdte',()=>{
 assert.match(src,/praktijkverbruik en temperatuurvoorspelling gebruiken alle beschikbare historische ritten/);
 assert.match(src,/Oudere detaildata kan door Recorder-retentie ontbreken/);
});
