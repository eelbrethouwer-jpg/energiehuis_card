'use strict';
// PR #58 kwaliteitsronde: betrouwbare dagtotalen, Alfen-laadsessie en kwartierprijzen (zomer-/wintertijd), zonder browser.
// Fragmenten 00, 01, 16 en 17 in één vm-context; de tijdzone wordt per test gezet (process.env.TZ).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const read=f=>fs.readFileSync(path.join(__dirname,'..','src','legacy',f),'utf8');
class EnergiehuisCard{_render(){}}
const ctx=vm.createContext({EnergiehuisCard,URL,Promise,setTimeout,clearTimeout,Date,JSON,Object,Math,Number,String,Array,Set,Map,Error,Intl,console});
vm.runInContext(['00-foundation.js','01-history-analytics.js','16-live-cockpit.js','17-live-immersive.js'].map(read).join('\n')+
 '\n;globalThis.__t={plan:ehImmDayPlan,ctr:ehImmCounterDay,sess:ehImmCurrentSession,q:ehImmQuarterModel,bars:ehImmQuarterBars,hash:ehImmHash,lines:ehImmDayLines,metrics:ehImmDayMetrics,live:ehImmLiveCounter,pv:ehImmPvSensorDay,cost:ehImmCostToday,unit:ehImmUnitKwh};',ctx,{filename:'00+01+16+17'});
const T0o=ctx.__t,H=3600000,norm=x=>JSON.parse(JSON.stringify(x));   // vm-arrays ⇒ gewone arrays
const T={...T0o,lines:(...a)=>norm(T0o.lines(...a)),sess:(...a)=>norm(T0o.sess(...a)),ctr:(...a)=>norm(T0o.ctr(...a)),metrics:(...a)=>norm(T0o.metrics(...a))};

function withTZ(tz,fn){const old=process.env.TZ;process.env.TZ=tz;try{return fn();}finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}}
const AMS='Europe/Amsterdam';

/** Uurrijen van lokale middernacht tot het laatste voltooide uur, met kWh-patroon k×(i%3+1). */
function rowsFor(plan,{k=.25,base=1000,skip=[],neg=[],noBase=false}={}){
 const rows=[];let state=base;
 if(!noBase)rows.push({start:plan.from-H,end:plan.from,state:base,sum:0,change:0});
 let total=0;
 for(let i=0;i<plan.full;i++){
  const ch=k*(i%3+1);state+=ch;total+=ch;
  if(skip.includes(i))continue;
  rows.push({start:plan.from+i*H,end:plan.from+(i+1)*H,state,sum:state-base,change:neg.includes(i)?-5:ch});
 }
 return {rows,total,state};
}
const liveAt=(plan,state,{k=.25,ageMin=1,frac=.5}={})=>{const i=plan.full;return {kwh:state+k*(i%3+1)*frac,t:plan.now-ageMin*60000};};

// ---------------------------------------------------------------- dagtotalen
test('dagtotaal: alle uren sinds lokale middernacht + live deel ⇒ complete en exact het verschil van de teller',()=>withTZ(AMS,()=>{
 const now=new Date(2026,10,12,14,37),plan=T.plan(now),{rows,total,state}=rowsFor(plan),live=liveAt(plan,state);
 assert.equal(plan.full,14,'14 voltooide uren (tot 14:00; 14:00–14:37 is nog onvolledig)');
 const r=T.ctr(rows,plan,live);
 assert.equal(r.status,'complete');assert.ok(Math.abs(r.kwh-(total+(live.kwh-state)))<1e-9);assert.equal(r.missing,0);assert.equal(r.bad,0);assert.equal(r.live,true);
}));

test('dagtotaal: ontbrekend meetuur (middenin of aan het begin van de dag) ⇒ partial (ondergrens), nooit complete',()=>withTZ(AMS,()=>{
 const now=new Date(2026,10,12,14,37),plan=T.plan(now);
 for(const skip of [[5],[0],[0,1,2]]){
  const {rows,total,state}=rowsFor(plan,{skip}),live=liveAt(plan,state);
  const r=T.ctr(rows,plan,live);
  assert.equal(r.status,'partial',JSON.stringify(skip));assert.equal(r.missing,skip.length);
  const gap=skip.reduce((a,i)=>a+.25*(i%3+1),0);
  assert.ok(Math.abs(r.kwh-(total-gap+(live.kwh-state)))<1e-9,'alleen aanwezige uren tellen mee: '+r.kwh);
 }
}));

test('dagtotaal: tellerreset of onmogelijke uurwaarde ⇒ partial en niet meegeteld; negatieve waarde nooit stilzwijgend nul als "volledig"',()=>withTZ(AMS,()=>{
 const now=new Date(2026,10,12,14,37),plan=T.plan(now);
 const {rows,state}=rowsFor(plan,{neg:[6]}),live=liveAt(plan,state);
 const r=T.ctr(rows,plan,live);assert.equal(r.status,'partial');assert.equal(r.bad,1);
 const big=rowsFor(plan).rows;big[3].change=999;assert.equal(T.ctr(big,plan,liveAt(plan,rowsFor(plan).state)).status,'partial');
}));

test('dagtotaal: live deel ontbreekt, is verouderd, heeft een onbekende eenheid of een reset ⇒ partial',()=>withTZ(AMS,()=>{
 const now=new Date(2026,10,12,14,37),plan=T.plan(now),{rows,state}=rowsFor(plan);
 assert.equal(T.ctr(rows,plan,null).status,'partial','geen live stand');
 assert.equal(T.ctr(rows,plan,liveAt(plan,state,{ageMin:45})).status,'partial','live stand 45 min oud');
 assert.equal(T.ctr(rows,plan,{kwh:state-3,t:plan.now-1000}).status,'partial','teller lager dan de laatste uurstand: reset');
 assert.equal(T.ctr(rows,plan,{kwh:state+500,t:plan.now-1000}).status,'partial','onmogelijke sprong');
 assert.equal(T.unit(12,'MJ'),null);assert.equal(T.unit(5000,'Wh'),5);assert.equal(T.unit(2,'MWh'),2000);
 const h={states:{'sensor.x':{state:'12',attributes:{unit_of_measurement:'MJ'},last_updated:new Date(plan.now-1000).toISOString()}}};
 assert.equal(T.live(h,'sensor.x'),null,'onbekende eenheid ⇒ geen live stand');
}));

test('dagtotaal: nul is een geldige waarde; ontbrekende statistieken zijn "missing", niet 0',()=>withTZ(AMS,()=>{
 const now=new Date(2026,10,12,14,37),plan=T.plan(now),{rows,state}=rowsFor(plan,{k:0});
 const z=T.ctr(rows,plan,liveAt(plan,state,{k:0}));assert.equal(z.status,'complete');assert.equal(z.kwh,0);
 const none=T.ctr([],plan,null);assert.equal(none.status,'missing');assert.equal(none.kwh,null);
 assert.equal(T.ctr([],plan,{kwh:5,t:plan.now}).status,'missing','zonder basisstand geen live deel');
}));

test('dagtotaal vlak na middernacht (geen voltooide uren): alleen live deel ten opzichte van de stand om middernacht',()=>withTZ(AMS,()=>{
 const now=new Date(2026,10,12,0,40),plan=T.plan(now);
 assert.equal(plan.full,0);
 const base={start:plan.from-H,end:plan.from,state:1000,sum:0,change:0};
 const r=T.ctr([base],plan,{kwh:1000.4,t:plan.now-60000});assert.equal(r.status,'complete');assert.ok(Math.abs(r.kwh-.4)<1e-9);
 assert.equal(T.ctr([],plan,{kwh:1000.4,t:plan.now-60000}).status,'missing');
}));

test('dagtotaal en zomertijd (23 uur) / wintertijd (25 uur): uren zijn echte tijdstippen',()=>withTZ(AMS,()=>{
 const spring=new Date(2026,2,29,14,37),pS=T.plan(spring);
 assert.equal((pS.nextMidnight-pS.from)/H,23,'zomertijddag duurt 23 uur');assert.equal(pS.full,13,'13 voltooide uren op 29 maart');
 const {rows,total,state}=rowsFor(pS),live=liveAt(pS,state),r=T.ctr(rows,pS,live);
 assert.equal(r.status,'complete');assert.ok(Math.abs(r.kwh-(total+(live.kwh-state)))<1e-9);
 const fall=new Date(2026,9,25,14,37),pF=T.plan(fall);
 assert.equal((pF.nextMidnight-pF.from)/H,25,'wintertijddag duurt 25 uur');assert.equal(pF.full,15,'15 voltooide uren op 25 oktober (dubbel uur 02:00–03:00)');
 const f=rowsFor(pF),r2=T.ctr(f.rows,pF,liveAt(pF,f.state));assert.equal(r2.status,'complete');
 // één uur van het dubbele uur ontbreekt ⇒ partial
 const g=rowsFor(pF,{skip:[3]});assert.equal(T.ctr(g.rows,pF,liveAt(pF,g.state)).status,'partial');
}));

test('dagtotaal in UTC: zelfde logica, geen aanname over Amsterdam',()=>withTZ('UTC',()=>{
 const now=new Date(Date.UTC(2026,10,12,14,37)),plan=T.plan(now),{rows,state}=rowsFor(plan);
 assert.equal(plan.full,14);assert.equal(T.ctr(rows,plan,liveAt(plan,state)).status,'complete');
}));

const cfg={import:'sensor.imp',export:'sensor.exp',laad_energie:'sensor.ev',zonne_energie:'sensor.pv',huis_energie:''};
function world({pv=21.8,evBase=5000,skipEv=[]}={}){
 const now=new Date(2026,10,12,14,37),plan=T.plan(now),rowsBy={},states={};
 const mk=(id,k,base,skip=[])=>{const f=rowsFor(plan,{k,base,skip});rowsBy[id]=f.rows;const live=liveAt(plan,f.state,{k});states[id]={state:String(live.kwh),attributes:{unit_of_measurement:'kWh'},last_updated:new Date(live.t).toISOString()};return {total:f.total+(live.kwh-f.state)};};
 const imp=mk('sensor.imp',.25,1200),exp=mk('sensor.exp',.18,800),ev=mk('sensor.ev',.3,evBase,skipEv);
 states['sensor.pv']={state:String(pv),attributes:{unit_of_measurement:'kWh'},last_updated:new Date(plan.now-60000).toISOString()};
 return {now,rowsBy,h:{states},imp,exp,ev};
}
test('dagtotalen: huis = afname − teruglevering + opwek − laden alleen als alle vier volledig zijn; anders "onvolledig"; inconsistent ⇒ onvolledig',()=>withTZ(AMS,()=>{
 const w=world(),m=T.metrics(cfg,w.h,w.rowsBy,w.now);
 assert.equal(m.pv.status,'complete');assert.equal(m.pv.sensor,true);
 assert.equal(m.home.status,'complete');assert.ok(Math.abs(m.home.kwh-(w.imp.total-w.exp.total+21.8-w.ev.total))<1e-6);
 const g=world({skipEv:[4]}),mg=T.metrics(cfg,g.h,g.rowsBy,g.now);
 assert.equal(mg.ev.status,'partial');assert.equal(mg.home.status,'incomplete');assert.equal(mg.home.kwh,null,'geen getal bij onvolledige bronnen');
 const bad=world({pv:0}),mb=T.metrics(cfg,bad.h,bad.rowsBy,bad.now);
 assert.equal(mb.home.status,'incomplete');assert.equal(mb.home.why,'inconsistent');
 const direct=T.metrics({...cfg,huis_energie:'sensor.hs'},w.h,w.rowsBy,w.now);assert.equal(direct.home.direct,true);assert.equal(direct.home.status,'missing','eigen kWh-teller zonder data: missing');
}));

test('opwek: dagsensor alleen vandaag bijgewerkt, ≥ 0 en in kWh/Wh; anders val terug op statistieken (partial) of niets',()=>withTZ(AMS,()=>{
 const now=new Date(2026,10,12,14,37);
 const st=(state,unit,upd)=>({states:{'sensor.pv':{state,attributes:{unit_of_measurement:unit},last_updated:upd}}});
 assert.equal(T.pv(st('12.4','kWh',new Date(2026,10,12,13,0).toISOString()),cfg,now).kwh,12.4);
 assert.equal(T.pv(st('12400','Wh',new Date(2026,10,12,13,0).toISOString()),cfg,now).kwh,12.4);
 assert.equal(T.pv(st('12.4','kWh',new Date(2026,10,11,23,0).toISOString()),cfg,now),null,'gisteren bijgewerkt');
 assert.equal(T.pv(st('-1','kWh',new Date(2026,10,12,13,0).toISOString()),cfg,now),null,'negatief');
 assert.equal(T.pv(st('12.4','MJ',new Date(2026,10,12,13,0).toISOString()),cfg,now),null,'onbekende eenheid');
 assert.equal(T.pv(st('unknown','kWh',new Date(2026,10,12,13,0).toISOString()),cfg,now),null);
}));

test('kosten: alleen een bedrag in euro dat vandaag is bijgewerkt (geen cent/onbekende eenheid, geen verouderde waarde, onbekend ≠ 0)',()=>withTZ(AMS,()=>{
 const now=new Date(2026,10,12,14,37),c={cost_zonneplan_day:'sensor.k'};
 const st=(state,unit,upd)=>({states:{'sensor.k':{state,attributes:{unit_of_measurement:unit},last_updated:upd}}});
 const today=new Date(2026,10,12,9,0).toISOString();
 assert.equal(T.cost(st('0.31','EUR',today),c,now),.31);assert.equal(T.cost(st('-0.12','€',today),c,now),-.12);assert.equal(T.cost(st('0','EUR',today),c,now),0);
 assert.equal(T.cost(st('31','ct',today),c,now),null);assert.equal(T.cost(st('0.31','EUR',new Date(2026,10,11,9,0).toISOString()),c,now),null);
 assert.equal(T.cost(st('unavailable','EUR',today),c,now),null);assert.equal(T.cost({states:{}},c,now),null);
}));

// ---------------------------------------------------------------- Cupra-laadsessie uit de Alfen-teller
const T0=Date.UTC(2026,10,12,12,0);
/** Historie van een teller: segmenten [vanMin,totMin,kW] t.o.v. T0; 5-minutenpunten. */
function meter(segs,{from=-36*60,to=0,reset=null,unit='kWh'}={}){
 const raw=min=>5000+segs.reduce((a,[f,e,kw])=>a+kw*Math.max(0,Math.min(min,e)-f)/60*(min>f?1:0),0);
 const val=min=>reset!==null&&min>=reset?raw(min)-raw(reset):raw(min);
 const pts=[];for(let m=from;m<=to;m+=5)pts.push({t:T0+m*60000,v:val(m),unit});
 if(reset!==null)pts.push({t:T0+(reset-.01)*60000,v:val(reset-.01),unit},{t:T0+reset*60000,v:val(reset),unit});
 pts.sort((a,b)=>a.t-b.t);
 return {pts,live:{kwh:val(to),t:T0+to*60000}};
}
const sess=(m,now=T0)=>T.sess(m.pts,m.live,now);

test('sessie: lopende sessie ⇒ kWh sinds de gemeten sessiestart (teller-verschil), niet de dagteller',()=>{
 const m=meter([[-120,-100,7.4],[-40,0,2.98]]),r=sess(m);
 assert.equal(r.ok,true);assert.ok(Math.abs(r.kwh-2.98*40/60)<0.02,'sessie ≈ 1,99 kWh, niet 3,7 (eerdere sessie): '+r.kwh);
});
test('sessie: pauze ≤ 45 min en hervatten blijft dezelfde sessie; pauze van 60 min start een nieuwe sessie',()=>{
 const a=meter([[-90,-50,2.98],[-20,0,2.98]]),ra=sess(a);
 assert.equal(ra.ok,true);assert.ok(Math.abs(ra.kwh-2.98*60/60)<0.03,'pauze 30 min: 40+20 min geladen = 2,98: '+ra.kwh);
 const b=meter([[-100,-70,2.98],[-20,0,2.98]]),rb=sess(b);
 assert.equal(rb.ok,true);assert.ok(Math.abs(rb.kwh-2.98*20/60)<0.03,'pauze 50 min: nieuwe sessie van 20 min: '+rb.kwh);
});
test('sessie: schaarse change-only historie met 90 minuten meetgat geeft geen bevestigd totaal',()=>{
 const pts=[[-180,100],[-130,100],[-120,101],[-110,102],[-20,103],[-10,104],[0,105]]
  .map(([m,v])=>({t:T0+m*60000,v,unit:'kWh'}));
 assert.deepEqual(T.sess(pts,{kwh:105,t:T0},T0),{ok:false,reason:'onderbroken meting'});
});
test('sessie: stijgende meetinterval tot 45 minuten blijft toegestaan, daarboven is de grens onzeker',()=>{
 for(const minutes of [45,46]){
  const pts=[[-180,100],[-120,100],[-110,101],[-110+minutes,102],[0,103]]
   .map(([m,v])=>({t:T0+m*60000,v,unit:'kWh'}));
  // Voeg na het te beoordelen gat regelmatige stijgingen toe tot nu.
  pts.pop();let v=102;for(let m=-110+minutes+5;m<0;m+=5)pts.push({t:T0+m*60000,v:++v,unit:'kWh'});
  const last=pts[pts.length-1];
  const r=T.sess(pts,{kwh:last.v,t:last.t},T0);
  assert.equal(r.ok,minutes===45,'meetinterval '+minutes+' min');
 }
});
test('sessie: na een onzeker meetgat en aantoonbare lange stilstand wordt een nieuwe sessie weer beschikbaar',()=>{
 const pts=[[-300,100],[-290,100],[-280,101],[-180,102],[-170,103],[-60,103],[-30,103],[-20,104],[-10,105],[0,106]]
  .map(([m,v])=>({t:T0+m*60000,v,unit:'kWh'}));
 const r=T.sess(pts,{kwh:106,t:T0},T0);
 assert.equal(r.ok,true);assert.equal(r.kwh,3);assert.equal(r.start,T0-30*60000);
});
test('sessie: nieuwe sessie na een eerdere sessie telt alleen de nieuwe',()=>{
 const m=meter([[-300,-200,7.4],[-30,0,7.4]]),r=sess(m);assert.equal(r.ok,true);assert.ok(Math.abs(r.kwh-7.4*30/60)<0.05,String(r.kwh));
});
test('sessie over middernacht: de start vóór middernacht telt mee (venster 36 uur, geen dagrand)',()=>withTZ(AMS,()=>{
 const m=meter([[-55,0,2.98]]),r=sess(m);
 assert.equal(r.ok,true);assert.ok(Math.abs(r.kwh-2.98*55/60)<0.03);
 // De berekening kent geen dagrand: dezelfde reeks met een lokale middernacht halverwege geeft hetzelfde resultaat.
 const mid=T0-30*60000,before=m.pts.filter(p=>p.t<mid).length,after=m.pts.filter(p=>p.t>=mid).length;assert.ok(before>3&&after>3,'de reeks loopt over het keerpunt');
}));
test('sessie: verouderde of ontbrekende gegevens ⇒ niet beschikbaar (nooit een schatting)',()=>{
 const m=meter([[-40,0,2.98]]);
 assert.equal(T.sess(m.pts,{...m.live,t:T0-20*60000},T0).ok,false,'live stand 20 min oud');
 assert.equal(T.sess(m.pts,null,T0).ok,false);assert.equal(T.sess([],m.live,T0).ok,false);assert.equal(T.sess(m.pts.slice(0,1),m.live,T0).ok,false);
 const u=meter([[-40,0,2.98]],{unit:'MJ'});assert.equal(sess(u).ok,false,'onbekende eenheid');
});
test('sessie: laden gestopt (> 45 min geleden) ⇒ geen actieve sessie',()=>{
 const m=meter([[-200,-100,2.98]]);const r=sess(m);assert.equal(r.ok,false);assert.equal(r.reason,'geen actieve sessie');
});
test('sessie: tellerreset tijdens de sessie ⇒ niet beschikbaar; reset lang vóór de sessie ⇒ gewoon beschikbaar',()=>{
 const a=meter([[-60,0,2.98]],{reset:-20}),ra=sess(a);assert.equal(ra.ok,false);
 const b=meter([[-30,0,2.98]],{reset:-600}),rb=sess(b);assert.equal(rb.ok,true);assert.ok(Math.abs(rb.kwh-2.98*30/60)<0.03);
});
test('sessie: geschiedenis begint midden in de sessie of bevat een meetgat ⇒ niet beschikbaar',()=>{
 const a=meter([[-300,0,2.98]],{from:-200}),ra=sess(a);assert.equal(ra.ok,false);assert.equal(ra.reason,'sessiestart buiten bereik');
 const m=meter([[-40,0,2.98]]);const gap=m.pts.filter(p=>!(p.t>T0-25*60000&&p.t<T0-10*60000));   // 15 min geen meetpunten, de teller steeg wel
 const rg=T.sess(gap,m.live,T0);assert.equal(rg.ok,true,'minder meetpunten maar plausibele, oplopende teller: sessie blijft bepaalbaar');assert.ok(Math.abs(rg.kwh-2.98*40/60)<0.03);
 const jump=[{t:T0-30*60000,v:5000,unit:'kWh'},{t:T0-10*60000,v:5090,unit:'kWh'}];
 assert.equal(T.sess(jump,{kwh:5091,t:T0},T0).ok,false,'onmogelijke sprong (270 kW)');
});

// ---------------------------------------------------------------- kwartierprijzen
function quarters(dayStart,n,price=i=>0.2+0.01*(i%10),skip=()=>false){
 const out=[];for(let i=0;i<n;i++){if(skip(i))continue;out.push({t:new Date(dayStart+i*900000).toISOString(),p:price(i)});}return out;
}
test('kwartieren: 96 op een normale dag, 92 bij zomertijd en 100 bij wintertijd (echte tijdstempels)',()=>withTZ(AMS,()=>{
 for(const [d,n] of [[new Date(2026,10,12,14,37),96],[new Date(2026,2,29,14,37),92],[new Date(2026,9,25,14,37),100]]){
  const m0=T.q([],d);assert.equal(m0.slots,n,d.toISOString());
  const start=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(),m=T.q(quarters(start,n),d);
  assert.equal(m.known,n);assert.equal(m.items.at(-1).i,n-1,'laatste kwartier van de dag heeft index '+(n-1));
  assert.equal(new Set(m.items.map(x=>x.i)).size,n,'geen botsende staven (ook niet bij het dubbele uur)');
  assert.equal(m.cur.t<=d.getTime()&&d.getTime()<m.cur.t+900000,true,'huidig kwartier = het kwartier waarin nu valt');
 }
}));
test('kwartieren: ontbrekende kwartieren blijven leeg, andere dagen en ongeldige waarden worden genegeerd, dubbele/ongesorteerde invoer is veilig',()=>withTZ(AMS,()=>{
 const d=new Date(2026,10,12,14,37),start=new Date(2026,10,12).getTime();
 const q=quarters(start,96,undefined,i=>i%7===3);
 q.push({t:new Date(start-900000).toISOString(),p:.5},{t:new Date(start+96*900000).toISOString(),p:.5},{t:'kapot',p:.3},{t:new Date(start).toISOString(),p:'x'});
 q.reverse();q.push({...q[0]});
 const m=T.q(q,d);
 assert.equal(m.known,96-Math.ceil(96/7)+0,'alleen kwartieren van vandaag, zonder gaten: '+m.known);
 assert.ok(m.items.every((x,i,a)=>i===0||a[i-1].i<x.i),'oplopend en uniek');
 assert.equal(m.cur&&m.cur.i,58,'14:37 ⇒ kwartier 58 (14:30)');
 const gapNow=T.q(quarters(start,96,undefined,i=>i===58),d);assert.equal(gapNow.cur,null,'huidig kwartier ontbreekt ⇒ geen waarde verzinnen');
}));
test('kwartieren: negatieve prijzen krijgen een nulbasislijn en hangen eronder; het huidige kwartier is gemarkeerd',()=>withTZ(AMS,()=>{
 const d=new Date(2026,10,12,14,37),start=new Date(2026,10,12).getTime();
 const m=T.q(quarters(start,96,i=>-0.05+0.002*i),d);
 assert.ok(m.min<0&&m.max>0);
 const svg=T.bars(m);
 assert.match(svg,/class="zero"/);assert.equal((svg.match(/class="now"/g)||[]).length,1);assert.equal((svg.match(/<rect/g)||[]).length,96);
 const neg=/<rect class="[^"]*" x="0\.08" y="([\d.]+)" width="\.84" height="([\d.]+)"/.exec(svg),zero=/class="zero" x1="0" x2="96" y1="([\d.]+)"/.exec(svg);
 assert.ok(neg&&zero&&Math.abs(parseFloat(neg[1])-parseFloat(zero[1]))<0.01,'negatieve staaf begint op de nulbasislijn en hangt eronder');
 const pos=T.q(quarters(start,96),d);assert.doesNotMatch(T.bars(pos),/class="zero"/,'alleen positieve prijzen: geen nullijn');
}));
test('kwartiergrafiek: viewBox en staafjes volgen het werkelijke aantal kwartieren; een gewijzigde prijs wijzigt de handtekening (zelfde lengte)',()=>withTZ(AMS,()=>{
 for(const [d,n] of [[new Date(2026,2,29,14,37),92],[new Date(2026,9,25,14,37),100]]){
  const start=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(),m=T.q(quarters(start,n),d),svg=T.bars(m);
  assert.equal((svg.match(/<rect/g)||[]).length,n);
  assert.ok(/class="nowline" x1="[\d.]+" x2="[\d.]+"/.test(svg));
 }
 const d=new Date(2026,10,12,14,37),start=new Date(2026,10,12).getTime();
 const a=quarters(start,96),b=quarters(start,96);b[80]={...b[80],p:b[80].p+0.01};     // toekomstig kwartier, zelfde tekenlengte
 const sig=q=>{const m=T.q(q,d);return T.hash(m.items.map(x=>x.i+':'+Math.round(x.p*10000)).join(','));};
 assert.notEqual(sig(a),sig(b));assert.equal(sig(a),sig(quarters(start,96)));
}));

// ---------------------------------------------------------------- tekstregels per schermbreedte
const ok=(kwh,status='complete')=>({kwh,status});
const D={pv:ok(21.8),home:ok(7.03),ev:ok(16.8),imp:ok(7.21),exp:ok(5.19)};
test('dagregels: vier vormen naar schermbreedte; altijd de belangrijkste gegevens, nooit stilzwijgend verborgen',()=>{
 const L=(k,sw,extra={})=>T.lines(k,D,extra,sw);
 assert.deepEqual(L('pv',900).lines,['Vandaag: 21,8 kWh']);assert.deepEqual(L('pv',400).lines,['Dag 21,8 kWh']);assert.deepEqual(L('pv',300).lines,['21,8 kWh']);
 assert.deepEqual(L('net',900,{cost:.31}).lines,['Afname: 7,21 kWh','Teruggeleverd: 5,19 kWh','Kosten: € 0,31']);
 assert.deepEqual(L('net',600,{cost:.31}).lines,['Af 7,21 · Terug 5,19 kWh','Kosten: € 0,31']);
 assert.deepEqual(L('net',400,{cost:.31}).lines,['Af 7,21 · € 0,31']);assert.deepEqual(L('net',300,{cost:.31}).lines,['7,21 kWh']);
 for(const sw of [900,600,400,300]){const r=L('net',sw,{cost:.31});assert.ok(r.lines.length>=1,'altijd minstens één regel op '+sw);assert.equal(r.aria.length,3,'toegankelijke naam bevat altijd afname, teruglevering en kosten');}
 assert.deepEqual(L('cupra',900,{session:{state:'ok',kwh:1.99}}).lines,['Vandaag: 16,8 kWh','Sessie: 1,99 kWh']);
 assert.deepEqual(L('cupra',400,{session:{state:'ok',kwh:1.99}}).lines,['Sessie 1,99 kWh'],'klein: sessie heeft voorrang');
 assert.deepEqual(L('cupra',400,{session:{state:'idle'}}).lines,['Dag 16,8 kWh']);
 assert.deepEqual(L('cupra',900,{session:{state:'unavailable'}}).lines,['Vandaag: 16,8 kWh','Sessie: niet beschikbaar']);
 assert.match(L('cupra',900,{session:{state:'unavailable'}}).aria.join(' '),/niet beschikbaar/);
 assert.deepEqual(L('cupra',900,{session:{state:'loading'}}).lines,['Vandaag: 16,8 kWh'],'tijdens het laden van de historie geen flikkerende regel');
});
test('dagregels (partial/incomplete/missing) per vorm',()=>{
 const P={pv:ok(3.1,'partial'),home:{kwh:null,status:'incomplete'},ev:{kwh:null,status:'missing'},imp:ok(2.2,'partial'),exp:{kwh:null,status:'missing'}};
 assert.deepEqual(T.lines('pv',P,{},900).lines,['Vandaag: ≥ 3,10 kWh (deels)']);
 assert.deepEqual(T.lines('pv',P,{},600).lines,['Vandaag: ≥ 3,10 kWh']);
 assert.deepEqual(T.lines('pv',P,{},400).lines,['Dag ≥ 3,10 kWh']);assert.deepEqual(T.lines('pv',P,{},300).lines,['≥ 3,10 kWh']);
 assert.match(T.lines('pv',P,{},900).aria[0],/gedeeltelijk gemeten, minstens 3,10 kWh/);
 assert.deepEqual(T.lines('house',P,{},900).lines,['Vandaag: onvolledig']);assert.deepEqual(T.lines('house',P,{},400).lines,['Dag onvolledig']);
 assert.deepEqual(T.lines('cupra',P,{session:{state:'idle'}},900).lines,[],'ontbrekend ⇒ geen regel');
 assert.deepEqual(T.lines('net',P,{cost:null},900).lines,['Afname: ≥ 2,20 kWh'],'teruglevering ontbreekt ⇒ geen 0 verzinnen');
 assert.deepEqual(T.lines('net',P,{cost:-0.12},900).lines,['Afname: ≥ 2,20 kWh','Kosten: −€ 0,12']);
});
