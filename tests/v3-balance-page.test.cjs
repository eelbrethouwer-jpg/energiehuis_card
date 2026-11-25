'use strict';
// Energiehuis 3.0: de Balans-pagina in de echte HACS-bundel, met nagebootste Home Assistant-data.
// Geen browser nodig: de kaart wordt in een vm geladen, de statistiek-aanroep wordt gesimuleerd.
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'energiehuis-card.js'),'utf8');
const NOW=Date.parse('2026-11-20T12:30:00Z');
let clock=NOW;
class FakeDate extends Date{constructor(...a){if(a.length)super(...a);else super(clock);}static now(){return clock;}}
const registry=new Map();
const ctx={console,Date:FakeDate,Math,Map,Set,Array,Object,Number,String,JSON,Intl,
 window:{customCards:[],navigator:{onLine:true},addEventListener(){}},
 customElements:{get:n=>registry.get(n),define:(n,x)=>registry.set(n,x)},
 HTMLElement:class{attachShadow(){this.shadowRoot={innerHTML:'',addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};return this.shadowRoot;}}};
vm.runInNewContext(source+'\n;globalThis.API={EnergiehuisCard,eh26Navigation,EH_VERSION};',ctx);
const {EnergiehuisCard,eh26Navigation}=ctx.API;
const iso=ms=>new Date(ms).toISOString();

const C={net:'sensor.p1',zonnepanelen:'sensor.pv',laden:'sensor.alfen',praktijk:'sensor.prak',prijs:'sensor.prijs',
 import:'sensor.imp',export:'sensor.exp',zonne_energie:'sensor.pve',laad_energie:'sensor.ale',praktijk_energie:'sensor.prake'};
function st(state,unit,ageS=5){return {state:String(state),attributes:{unit_of_measurement:unit},last_reported:iso(NOW-ageS*1000),last_updated:iso(NOW-ageS*1000),last_changed:iso(NOW-ageS*1000)};}
function hass(over={},extra={}){
 const states={'sensor.p1':st(-780,'W'),'sensor.pv':st(5200,'W'),'sensor.alfen':st(3700,'W'),'sensor.prak':st(120,'W'),'sensor.prijs':st(0.3,'€/kWh'),
  'sensor.imp':st(100,'kWh'),'sensor.exp':st(50,'kWh'),'sensor.pve':st(10,'kWh'),'sensor.ale':st(20,'kWh'),'sensor.prake':st(5,'kWh'),...over};
 for(const k of Object.keys(states))if(states[k]===null)delete states[k];
 return {states,callWS:extra.callWS};
}
function makeCard(config,h){
 const card=new EnergiehuisCard();
 card.config={...C,...config};card._hass=h;card._view='balance';
 card._schedule=()=>{};
 return card;
}
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ');

test('Home-lagen zijn byte-identiek aan v1.32.0 (beginpagina blijft onaangeroerd)',()=>{
 const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'src','legacy',f))).digest('hex');
 assert.equal(sha('16-live-cockpit.js'),'22f687ad807f989a2ae151b8d6b793a53c0f9e0b842bb9c0b2e836790787f6c5');
 assert.equal(sha('17-live-immersive.js'),'c180d9f407a42d4ce2277eb37f2c48a6f7aac25f97e16c87e1403efaa0f556e9');
});

test('navigatie: Balans staat in het Inzicht-menu en markeert Inzicht als actief',()=>{
 const closed=eh26Navigation('balance',false),open=eh26Navigation('balance',true);
 assert.match(closed,/eh26-navitem active"[^>]*data-eh26-insights/);
 assert.match(open,/data-eh-page="balance"/);
 assert.match(open,/<strong>Balans<\/strong>/);
 assert.doesNotMatch(eh26Navigation('overview',false),/active"[^>]*data-eh26-insights/);
});

test('live balans: Woning, verbruik en eigen zon uit vier bronnen, met sluitende controle (scenario 4)',()=>{
 const card=makeCard({},hass());
 const html=card._balanceHtml(card._hass,card.config),t=text(html);
 assert.match(t,/Nu 4,4 kW verbruik · 4,4 kW eigen zon · 0 W van het net · 780 W terug/);
 assert.match(t,/Woning\s+Restpost/);
 assert.match(t,/Woning 600 W \+ Praktijk 120 W \+ Cupra 3,7 kW = Net -780 W \+ Zon 5,2 kW/);
 assert.match(html,/class="eh3-row-val">600 W/);
});

test('verouderde bron: geen Woning-getal en geen fictieve nul',()=>{
 const h=hass({'sensor.alfen':st(3700,'W',400)});
 const card=makeCard({},h);
 const html=card._balanceHtml(h,card.config);
 assert.match(html,/class="eh3-row-val">—<\/span>/);
 assert.match(text(html),/Een bron ontbreekt of is niet actueel\. \(Cupra \(Alfen\)\)/);
 assert.doesNotMatch(text(html),/Nu .* verbruik/);
});

test('GoodWe unavailable bij zon boven de horizon: onbeschikbaar; bij bewezen nacht: geschat',()=>{
 const day=hass({'sensor.pv':st('unavailable','W'),'sun.sun':{state:'above_horizon',attributes:{},last_reported:iso(NOW)}});
 const cardDay=makeCard({},day);
 assert.match(cardDay._balanceHtml(day,cardDay.config),/Een bron ontbreekt/);
 // Nacht: eerst een geldige lage PV-waarde, daarna uitval.
 const ok=hass({'sensor.pv':st(10,'W'),'sensor.p1':st(450,'W'),'sensor.alfen':st(0,'W'),'sensor.prak':st(60,'W'),'sun.sun':{state:'below_horizon',attributes:{},last_reported:iso(NOW)}});
 const cardNight=makeCard({},ok);
 cardNight._balanceHtml(ok,cardNight.config);
 const out=hass({'sensor.pv':st('unavailable','W'),'sensor.p1':st(450,'W'),'sensor.alfen':st(0,'W'),'sensor.prak':st(60,'W'),'sun.sun':{state:'below_horizon',attributes:{},last_reported:iso(NOW)}});
 cardNight._hass=out;
 const html=cardNight._balanceHtml(out,cardNight.config);
 assert.match(text(html),/Geschat: nacht, zon onder de horizon/);
 assert.match(html,/class="eh3-row-val">390 W<i class="eh3-dot q-geschat"/);
});

test('onbekende eenheid wordt nooit als W aangenomen',()=>{
 const h=hass({'sensor.p1':st(450,'MW')});
 const card=makeCard({},h);
 assert.match(card._balanceHtml(h,card.config),/Een bron ontbreekt/);
});

// ---- Periode uit statistiek ---------------------------------------------------------------------------
function statsFor(ids,startIso,endIso,per){
 const from=Date.parse(startIso),to=Date.parse(endIso),out={};
 for(const id of ids){
  out[id]=[];
  for(let t=from;t<to;t+=3600000){
   const v=per[id];
   if(v===undefined)continue;
   if(typeof v==='function'){const r=v(t);if(r)out[id].push({start:t,...r});}
   else out[id].push({start:t,...v});
  }
 }
 return out;
}
const HOURLY={'sensor.imp':{change:1.0},'sensor.exp':{change:0.2},'sensor.pve':{change:0.5},'sensor.ale':{change:0.3},'sensor.prake':{change:0.1},'sensor.prijs':{mean:0.3}};
async function load(config,per,period='yesterday',h0){
 const calls=[];
 const h=h0||hass();
 h.callWS=async msg=>{calls.push(msg);return statsFor(msg.statistic_ids,msg.start_time,msg.end_time,per);};
 const card=makeCard(config,h);
 card._balPeriod=period;
 await card._loadBalance();
 return {card,h,calls};
}

test('gisteren: kWh uit tellers, kosten sluiten en bedragen tellen exact op',async()=>{
 const {card,h,calls}=await load({},HOURLY);
 const r=card._balResult,n=r.hours;
 assert.ok(n===24||n===23||n===25);
 assert.equal(calls[0].period,'hour');
 assert.equal(JSON.stringify(calls[0].types),'["change","mean"]');
 assert.equal(r.error,null);
 assert.equal(r.agg.partial,false);
 const t=r.agg.totals;
 assert.ok(Math.abs(t.verbruik-1.3*n)<1e-9);
 assert.ok(Math.abs(t.woning-0.9*n)<1e-9);
 assert.ok(Math.abs(t.cupra-0.3*n)<1e-9);
 assert.ok(Math.abs(r.cost.netKosten-0.24*n)<1e-9,'netto = (1,0 − 0,2) kWh × € 0,30 per uur (saldering)');
 assert.ok(r.cost.checks.aMinusZon<1e-9&&r.cost.checks.aandelenMinusTeruglever<1e-9);
 const html=card._balanceHtml(h,card.config),t2=text(html);
 assert.match(t2,new RegExp('Alle '+n+' uren zijn compleet'));
 assert.match(t2,/Tot en met 31 december 2026 geldt saldering/);
 assert.match(t2,/Woning .* Praktijkruimte .* Cupra/);
 assert.match(t2,/Netto = afname € [\d.,]+ − teruglevering € [\d.,]+ = € [\d.,]+/);
 // Bedragen in de tabel tellen op tot het totaal.
 const rows=[...html.matchAll(/<th scope="row">[^<]+<\/th><td>[^<]+<\/td><td>€ ([\d.,]+)<\/td>/g)].map(m=>Number(m[1].replace('.','').replace(',','.')));
 assert.equal(rows.length,3);
 const total=Math.round(r.cost.A_total*100)/100;
 assert.ok(Math.abs(rows.reduce((a,b)=>a+b,0)-total)<0.005,'waarde per verbruiker telt op tot het totaal');
});

test('ontbrekende tellerstatistiek: onderdeel wordt genoemd en nooit als 0 meegeteld',async()=>{
 const per={...HOURLY};delete per['sensor.ale'];
 const {card,h}=await load({},per);
 const r=card._balResult;
 assert.equal(r.missing.length,1);
 assert.equal(r.missing[0].key,'alfen');
 assert.equal(r.agg.complete,0);
 assert.equal(r.agg.totals.woning,null);
 assert.match(text(card._balanceHtml(h,card.config)),/Geen statistiek voor: Laadenergie \(Alfen\)/);
});

test('geen prijshistorie: kosten ontbreken met uitleg, energie blijft zichtbaar',async()=>{
 const per={...HOURLY};delete per['sensor.prijs'];
 const {card,h}=await load({},per);
 const t=text(card._balanceHtml(h,card.config));
 assert.match(t,/Geen prijshistorie gevonden/);
 assert.match(t,/verbruikt/);
});

test('gat in één uur: totaal is "minimaal" met dekking en niet aangevuld',async()=>{
 let hit=0;
 const per={...HOURLY,'sensor.imp':t=>{hit++;return hit===5?null:{change:1.0};}};
 const {card,h}=await load({},per);
 const r=card._balResult;
 assert.equal(r.agg.partial,true);
 assert.equal(r.agg.complete,r.hours-1);
 assert.match(text(card._balanceHtml(h,card.config)),/Minimaal: \d+ van \d+ uren zijn compleet/);
});

test('Wh-teller wordt omgerekend; onbekende eenheid sluit de teller uit',async()=>{
 const h=hass({'sensor.ale':st(20000,'Wh')});
 const per={...HOURLY,'sensor.ale':{change:300}};
 const {card}=await load({},per,'yesterday',h);
 assert.ok(Math.abs(card._balResult.agg.totals.cupra-0.3*card._balResult.hours)<1e-9);
 const h2=hass({'sensor.ale':st(20,'bananen')});
 const {card:c2}=await load({},HOURLY,'yesterday',h2);
 assert.equal(c2._balResult.missing[0].reason,'onbekende eenheid');
});

test('praktijk niet gekoppeld: Woning bevat de praktijk en dat wordt gezegd',async()=>{
 const per={...HOURLY};
 const {card,h}=await load({praktijk:'',praktijk_energie:''},per);
 const r=card._balResult;
 assert.equal(r.praktijkOn,false);
 assert.ok(Math.abs(r.agg.totals.woning-1.0*r.hours)<1e-9);
 assert.match(text(card._balanceHtml(h,card.config)),/Praktijkruimte is niet gekoppeld; Woning bevat die dan/);
});

test('na 1 januari 2027 zonder ingestelde vergoeding: netto en zonvoordeel blijven leeg, afname wordt wel getoond',async()=>{
 clock=Date.parse('2027-02-03T12:30:00Z');
 try{
  const {card,h}=await load({},HOURLY);
  const r=card._balResult,n=r.hours;
  assert.equal(JSON.stringify(r.cost.regimes),'["vergoeding"]');
  assert.equal(r.cost.netKosten,null);
  assert.equal(r.cost.zonneImpact,null);
  assert.equal(r.cost.qMissing,n);
  assert.ok(Math.abs(r.cost.afnameKosten-1.0*0.3*n)<1e-9);
  const t=text(card._balanceHtml(h,card.config));
  assert.match(t,/Vanaf 1 januari 2027 stopt saldering/);
  assert.match(t,/Terugleververgoeding niet ingesteld voor \d+ uur/);
  assert.match(t,/Afname betaald/);
  assert.doesNotMatch(t,/Netto = afname/);
 }finally{clock=NOW;}
});

test('na 1 januari 2027 met ingestelde vergoeding (getal of sensor): netto = afname − teruglevering × q',async()=>{
 clock=Date.parse('2027-02-03T12:30:00Z');
 try{
  for(const setting of [0.07,'sensor.terug']){
   const h=hass({'sensor.terug':st(0.07,'€/kWh')});
   const {card}=await load({terugleververgoeding:setting},HOURLY,'yesterday',h);
   const r=card._balResult,n=r.hours;
   assert.equal(r.cost.qComplete,true);
   assert.ok(Math.abs(r.cost.netKosten-(1.0*0.3-0.2*0.07)*n)<1e-9,String(setting));
   assert.ok(Math.abs(r.cost.zonneImpact-(0.3*0.3+0.2*0.07)*n)<1e-9,'zon-impact = S·p + E·q');
   assert.ok(r.cost.checks.aMinusZon<1e-9);
  }
 }finally{clock=NOW;}
});

test('meetcontrole: P1-teken, DC-indicatie en sluiting uit twee weken uurdata',async()=>{
 // P1-vermogen volgt de tellers (afname positief); PV-vermogen ligt 3 % boven de PV-teller.
 const per={...HOURLY,
  'sensor.imp':{change:1.0},'sensor.exp':{change:0.2},
  'sensor.p1':{mean:800},          // 1,0 − 0,2 kWh per uur = +800 W gemiddeld
  'sensor.pv':{mean:515},          // 0,5 kWh teller, 515 W vermogen = +3 %
  'sensor.pve':{change:0.5},'sensor.alfen':{mean:300},'sensor.ale':{change:0.3},'sensor.prak':{mean:100},'sensor.prake':{change:0.1}};
 const {card,h}=await load({},per,'yesterday');
 for(let i=0;i<20&&!card._balDiag;i++)await new Promise(r=>setTimeout(r,0));
 const d=card._balDiag.result;
 assert.equal(d.sign.verdict,'import_positive');
 assert.equal(d.pv.verdict,'vermogen_hoger');
 assert.ok(Math.abs(d.pv.ratio-1.03)<1e-9);
 assert.equal(d.alfen.verdict,'ok');
 assert.equal(d.closure.verdict,'ok');
 const t=text(card._balanceHtml(h,card.config));
 assert.match(t,/Klopt: positief vermogen betekent afname/);
 assert.match(t,/Het vermogen ligt 3,0% boven de teller\. Waarschijnlijk meet de sensor DC-vermogen/);
 assert.match(t,/Sluiting uurbalans/);
 // Omgekeerd P1-teken in de kaartconfiguratie wordt als conflict gemeld.
 const card2=makeCard({p1_sign:'export_positive'},h);card2._balDiag=card._balDiag;card2._balResult=card._balResult;card2._balPeriod='yesterday';
 assert.match(text(card2._balanceHtml(h,card2.config)),/kaart staat op export_positive, maar de P1-sensor is positief bij afname/);
});

test('statistiek-aanroep is alleen lezen: geen servicecalls en geen opslag',async()=>{
 const {calls}=await load({},HOURLY);
 assert.ok(calls.length>=1);
 assert.ok(calls.every(c=>c.type==='recorder/statistics_during_period'));
 const code=fs.readFileSync(path.join(root,'src','legacy','18-balance-page.js'),'utf8');
 for(const banned of ['callService','localStorage','sessionStorage','fetch(','XMLHttpRequest'])assert.equal(code.includes(banned),false,banned);
});

test('periodeknoppen: elke periode krijgt een eigen sleutel en kent vijf keuzes',async()=>{
 const {card,h}=await load({},HOURLY,'today');
 const html=card._balanceHtml(h,card.config);
 assert.equal((html.match(/data-eh3-period=/g)||[]).length,5);
 assert.match(html,/data-eh3-period="today" aria-pressed="true"/);
 const keyToday=card._balResult.key;
 card._balPeriod='7d';await card._loadBalance();
 assert.notEqual(card._balResult.key,keyToday);
 assert.equal(card._balResult.period,'7d');
});

test('fout in de statistiek geeft een duidelijke melding en geen cijfers',async()=>{
 const h=hass();
 h.callWS=async()=>{throw new Error('boom');};
 const card=makeCard({},h);card._balPeriod='yesterday';
 await card._loadBalance();
 const t=text(card._balanceHtml(h,card.config));
 assert.match(t,/Langetermijnstatistieken zijn niet beschikbaar/);
 assert.equal(card._balResult.agg,null);
});

test('render van de pagina via de kaart gebruikt de balance-view; Home gebruikt hem niet',()=>{
 const card=makeCard({},hass());
 card._render();
 const html=card.shadowRoot.innerHTML;
 assert.match(html,/<main class="subpage eh3">/);
 assert.match(html,/Energiebalans/);
 const nav=html.match(/<nav class="nav"/);
 assert.ok(nav,'navigatie blijft aanwezig');
});

test('nachtbewijs komt ook uit de statistiek als de kaart pas na uitval van de GoodWe wordt geopend',async()=>{
 // Zon onder de horizon, GoodWe al unavailable, geen geheugen: de laatste PV-uurwaarde in de statistiek was 12 W.
 const h=hass({'sensor.pv':st('unavailable','W'),'sensor.p1':st(450,'W'),'sensor.alfen':st(0,'W'),'sensor.prak':st(60,'W'),'sun.sun':{state:'below_horizon',attributes:{},last_reported:iso(NOW)}});
 const per={...HOURLY,'sensor.pv':t=>t<NOW-3*3600000?{mean:12}:null};
 const {card}=await load({},per,'yesterday',h);
 for(let i=0;i<20&&!card._balDiag;i++)await new Promise(r=>setTimeout(r,0));
 assert.equal(card._balDiag.result.lastPvW,12);
 const html=card._balanceHtml(h,card.config);
 assert.match(text(html),/Geschat: nacht, zon onder de horizon/);
 assert.match(html,/class="eh3-row-val">390 W<i class="eh3-dot q-geschat"/);
 // Zonder bewijs in de statistiek, of met een hoge laatste waarde, blijft PV onbeschikbaar.
 const high=await load({},{...HOURLY,'sensor.pv':t=>t<NOW-3*3600000?{mean:900}:null},'yesterday',h);
 for(let i=0;i<20&&!high.card._balDiag;i++)await new Promise(r=>setTimeout(r,0));
 assert.match(text(high.card._balanceHtml(h,high.card.config)),/Een bron ontbreekt of is niet actueel/);
});

test('niet-beschikbare waarden tonen één streepje, geen dubbele markering',()=>{
 const h=hass({'sensor.alfen':st(3700,'W',600)});
 const card=makeCard({},h);
 const html=card._balanceHtml(h,card.config);
 assert.match(html,/class="eh3-row-val">—<\/span>/);
});

test('meetcontrole wordt niet opnieuw opgehaald bij een periodewissel',async()=>{
 const {card,calls}=await load({},HOURLY,'today');
 for(let i=0;i<20&&!card._balDiag;i++)await new Promise(r=>setTimeout(r,0));
 const before=calls.length;
 card._balPeriod='7d';await card._loadBalance();
 assert.equal(calls.length,before+1,'alleen de periode zelf wordt opgehaald');
});

test('na 2026 zonder uren met data meldt de banner het juiste regime',async()=>{
 clock=Date.parse('2027-02-03T12:30:00Z');
 try{
  const per={...HOURLY};delete per['sensor.imp'];
  const {card,h}=await load({},per);
  assert.match(text(card._balanceHtml(h,card.config)),/Vanaf 1 januari 2027 stopt saldering/);
 }finally{clock=NOW;}
});

test('oudere HA zonder last_reported: constante sensor blijft bruikbaar en de tijdspreiding wordt niet misbruikt',()=>{
 const old=(state,unit,ageS)=>({state:String(state),attributes:{unit_of_measurement:unit},last_updated:iso(NOW-ageS*1000),last_changed:iso(NOW-ageS*1000)});
 // Alfen meldt al 20 minuten constant 0 W; P1 en PV zijn vers.
 const h=hass({'sensor.p1':old(450,'W',2),'sensor.pv':old(0,'W',30),'sensor.alfen':old(0,'W',1200),'sensor.prak':old(60,'W',100)});
 const card=makeCard({},h);
 const html=card._balanceHtml(h,card.config);
 assert.match(html,/class="eh3-row-val">390 W/);
 assert.doesNotMatch(text(html),/lopen niet gelijk/);
 // Binnen de ruimere TTL; daarbuiten (>2100 s) blijft verouderd.
 const stale=hass({'sensor.p1':old(450,'W',2),'sensor.pv':old(0,'W',30),'sensor.alfen':old(0,'W',3000),'sensor.prak':old(60,'W',100)});
 const c2=makeCard({},stale);
 assert.match(c2._balanceHtml(stale,c2.config),/class="eh3-row-val">—<\/span>/);
});
