'use strict';
// Energiehuis 3.1: Geld › Kwartieren (pagina in de echte bundel, zonder browser).
// Geen browser nodig: de kaart wordt in een vm geladen, de statistiek-aanroep wordt gesimuleerd.
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'energiehuis-card.js'),'utf8');
let clock=Date.parse('2026-11-20T12:30:00Z');
class FakeDate extends Date{constructor(...a){if(a.length)super(...a);else super(clock);}static now(){return clock;}}
const registry=new Map();
const ctx={console,Date:FakeDate,Math,Map,Set,Array,Object,Number,String,JSON,Intl,
 window:{customCards:[],navigator:{onLine:true},addEventListener(){}},
 customElements:{get:n=>registry.get(n),define:(n,x)=>registry.set(n,x)},
 HTMLElement:class{attachShadow(){this.shadowRoot={innerHTML:'',addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};return this.shadowRoot;}}};
vm.runInNewContext(source+'\n;globalThis.API={ehQtHtml,ehQtPills,EHNV_SEGMENTS};globalThis.API2={load:EnergiehuisCard.prototype._ehQtLoadBack};',ctx);
const {ehQtHtml,ehQtPills,EHNV_SEGMENTS}=ctx.API;
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ');
const mid=()=>new FakeDate(2026,10,26).getTime();
function quarters(day,n=96,f=i=>0.2+i/1000){const s=new Date(2026,10,26+day).getTime();return Array.from({length:n},(_,i)=>({start_date:new Date(s+i*900000).toISOString(),price:f(i)}));}
function card(forecast,extra={}){
 clock=mid()+13*3600000+20*60000;
 const states={'sensor.kw':{state:'0.3',attributes:{unit_of_measurement:'€/kWh',forecast}}};
 const c={card:null};
 return {_hass:{states,callWS:extra.callWS},config:{kwartier_forecast:'sensor.kw',prijs:'sensor.kw',import:'sensor.imp',export:'sensor.exp',...(extra.config||{})},_ehQtDay:extra.day||'today',_schedule(){}};
}

test('segment staat in Geld tussen Kosten en Contracten en gebruikt de kostenpagina',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(EHNV_SEGMENTS.money.map(s=>s.id))),['costs','quarters','contracts']);
 assert.equal(EHNV_SEGMENTS.money[1].view,'costs');
});

test('vandaag: kerncijfers, grafiek met toegankelijke samenvatting, vensters en alle kwartieren',()=>{
 const html=ehQtHtml(card(quarters(0)));
 assert.match(text(html),/Nu € 0,\d{3} per kWh/);
 assert.match(html,/role="img" aria-label="Prijs per kwartier: laagste/);
 assert.equal((html.match(/<rect class="ehqt-(low|mid|high)/g)||[]).length,96);
 assert.match(text(html),/Goedkoopste 2 uur vanaf nu/);assert.match(text(html),/Goedkoopste 4 uur vanaf nu/);
 assert.match(text(html),/Alle kwartieren \(96\)/);
 assert.match(html,/data-ehqt-day="today"[^>]*aria-pressed="true"/);
});

test('morgen nog niet bekend: geen verzonnen prijzen; gedeeltelijke dag meldt precies hoeveel bekend is',()=>{
 const none=ehQtHtml(card(quarters(0),{day:'tomorrow'}));
 assert.match(text(none),/prijzen van morgen zijn nog niet bekend/);assert.doesNotMatch(none,/<rect/);
 const part=ehQtHtml(card(quarters(0,60)));
 assert.match(text(part),/Nog niet volledig: 60 van 96 kwartieren bekend/);
 const tom=ehQtHtml(card(quarters(0).concat(quarters(1)),{day:'tomorrow'}));
 assert.match(tom,/data-ehqt-day="tomorrow"[^>]*aria-pressed="true"/);assert.doesNotMatch(tom,/vanaf nu/);
});

test('zonder prijssensor met kwartieren: duidelijke melding over de koppeling',()=>{
 const c=card([]);c._hass.states['sensor.kw'].attributes.forecast=[];
 assert.match(text(ehQtHtml(c)),/Koppel een prijssensor met kwartierprijzen/);
});

test('terugkijken: kosten per kwartier uit geschiedenis en 5-minutenstatistiek; ontbrekende kwartieren tellen niet mee',async()=>{
 const day0=new FakeDate(2026,10,25).getTime();
 const calls=[];
 const callWS=async m=>{
  calls.push(m.type);
  if(m.type==='history/history_during_period')return {'sensor.kw':[{s:'0.30',lu:(day0-3600000)/1000}]};
  const rows=[];
  for(let t=day0;t<day0+86400000;t+=300000){if(t>=day0+86400000-3*900000)continue;rows.push({start:t,change:0.05});}
  return {'sensor.imp':rows,'sensor.exp':rows.map(r=>({...r,change:0}))};
 };
 const c=card(quarters(0),{callWS,day:'back:1'});
 c._hass.states['sensor.imp']={state:'1',attributes:{unit_of_measurement:'kWh'}};
 c._hass.states['sensor.exp']={state:'1',attributes:{unit_of_measurement:'kWh'}};
 await EnergiehuisCardProto(c);
 const html=ehQtHtml(c);
 assert.match(text(html),/93 van 96 kwartieren compleet/);
 assert.match(text(html),/Netto kosten € 4,1[89]/);
 assert.deepEqual(calls.sort(),['history/history_during_period','recorder/statistics_during_period']);
 assert.ok(!calls.some(t=>/service/.test(t)),'alleen lezen');
});
async function EnergiehuisCardProto(c){await ctx.API2.load.call(c,1);}

test('terugkijken: ontbrekende koppelingen en een fout geven een melding in plaats van een getal',async()=>{
 const c=card(quarters(0),{day:'back:1',config:{import:''}});
 await ctx.API2.load.call(c,1);
 assert.match(text(ehQtHtml(c)),/Koppel de tellers voor import en export/);
 const d=card(quarters(0),{day:'back:1',callWS:async()=>{throw new Error('boem');}});
 d._hass.states['sensor.imp']={state:'1',attributes:{unit_of_measurement:'kWh'}};
 await ctx.API2.load.call(d,1);
 assert.match(text(ehQtHtml(d)),/boem/);
});
