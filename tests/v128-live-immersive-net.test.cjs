'use strict';
// v1.28-voorstel (PR #56): Net-bestemmingspagina gebruikt dezelfde neutrale netpresentatie als de Home-tegel
// (EhPve04Model.netPresentation). Richting alleen bij een actieve netroute; de ruwe, ondertekende P1-waarde staat
// uitsluitend in de technische diagnose. Zonder browser: fragmenten 16 + 17 geïsoleerd in een vm-context.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ehEsc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));

function load(){
 class EnergiehuisCard{_render(){}}
 const ctx=vm.createContext({EnergiehuisCard,ehEsc,URL,Promise,setTimeout,clearTimeout,Date,JSON,Object,Math,Number,String,Array,Set,Map,Error});
 vm.runInContext(read('src/legacy/16-live-cockpit.js')+'\n'+read('src/legacy/17-live-immersive.js')+
  '\n;globalThis.__t={api:EhLiveCockpit,page:ehImmPageHtml,net:ehImmNetView};',ctx,{filename:'16+17'});
 return ctx.__t;
}
const T=load();
const M=T.api.scope.EhPve04Model,A=T.api.scope.EhHaAdapter;
const CONFIG={live_cockpit:true,live_cockpit_immersive:true};
const ID={net:'sensor.p1_meter_vermogen',pv:'sensor.goodwe_pv_power',house:'sensor.energiehuis_huisverbruik_exclusief_auto',ev:'sensor.alfen_actief_vermogen_totaal'};

/** Simuleert HA-states; age in seconden t.o.v. nu (per bron instelbaar). */
function hassOf(v,age={}){
 const now=Date.now(),states={};
 for(const k of Object.keys(ID)){
  const ts=new Date(now-1000*(age[k]??2)).toISOString();
  states[ID[k]]={entity_id:ID[k],state:String(v[k]),attributes:{unit_of_measurement:'W'},last_updated:ts,last_changed:ts};
 }
 return {connected:true,states};
}
function cardOf(hass,prevModel=null){
 const adapter=A.createAdapter(T.api.liveConfig(CONFIG));
 return {config:CONFIG,_hass:hass,_ehLive:{ctl:{adapter,cockpit:{model:prevModel}}}};
}
/** Pagina-HTML plus de zichtbare waarde/het label en de diagnoseregels. */
function grid(v,age,prev){
 const card=cardOf(hassOf(v,age),prev);
 const html=T.page(card,'grid');
 const now=/<section class="eh-imm-now" data-tone="([^"]*)"(?: data-direction="([^"]*)")?[^>]*><strong>([^<]*)<\/strong><span>([^<]*)<\/span><\/section>/.exec(html);
 assert.ok(now,'meetblok aanwezig');
 const meta={};for(const [,k,x] of html.matchAll(/<dt>([^<]*)<\/dt><dd>([^<]*)<\/dd>/g))meta[k]=x;
 const m=M.computeModel(card._ehLive.ctl.adapter.input(card._hass,Date.now()),prev);
 return {html,tone:now[1],direction:now[2],value:now[3],label:now[4],meta,model:m,np:M.netPresentation(m)};
}
const MINUS='−';

test('Net-pagina: synchrone afname ⇒ bevestigde richting, zelfde waarde en label als de Home-tegel',()=>{
 const r=grid({net:1500,pv:0,house:1500,ev:0});
 assert.equal(r.model.routes['grid-home'].active,true);
 assert.equal(r.np.confirmed,true);
 assert.equal(r.value,r.np.value);assert.equal(r.value,'1,50 kW');
 assert.equal(r.label,'Afname van het net');
 assert.equal(r.direction,'import');
 assert.match(r.meta['Bevestigde richting'],/^Afname van het net \(bevestigd/);
 assert.equal(r.meta['Ruwe P1-sensorwaarde (ondertekend)'],'1500 W');
 assert.equal(r.meta['Meetketen'],undefined,'geen ketenmelding bij een sluitende synchrone meting');
});

test('Net-pagina: teruglevering ⇒ minteken alleen bij bevestigde richting; ruwe P1 ondertekend in de diagnose',()=>{
 const r=grid({net:-1880,pv:4820,house:1460,ev:1480});
 assert.equal(r.np.confirmed,true);
 assert.equal(r.value,MINUS+'1,88 kW');
 assert.equal(r.label,'Teruglevering aan het net');
 assert.equal(r.direction,'export');
 assert.equal(r.meta['Ruwe P1-sensorwaarde (ondertekend)'],'-1880 W');
});

test('Net-pagina: niet-synchrone meetketen ⇒ absolute P1 zonder teken, "richting niet bevestigd"',()=>{
 // huissensor 30 s ouder dan de rest (spreiding > 10 s) en de balans sluit niet ⇒ routes gepauzeerd (hold)
 const r=grid({net:-1880,pv:4820,house:2500,ev:1480},{house:32});
 assert.ok(r.model.hold,'model staat in hold');assert.equal(r.model.critical,false);
 assert.equal(r.np.unconfirmed,true);
 assert.equal(r.value,'1,88 kW');
 assert.ok(!r.html.includes(MINUS+'1,88'),'geen ondertekende waarde in de hoofdweergave');
 assert.equal(r.label,'P1-meting · richting niet bevestigd (meetketen niet synchroon)');
 assert.equal(r.direction,'unconfirmed');
 assert.equal(r.tone,'warn');
 assert.equal(r.meta['Bevestigde richting'],'Niet bevestigd (meetketen niet synchroon)');
 assert.equal(r.meta['Ruwe P1-sensorwaarde (ondertekend)'],'-1880 W','ruwe waarde blijft in de diagnose');
 assert.match(r.meta['Meetketen'],/^Meetketen niet synchroon · /);
 assert.doesNotMatch(r.html,/Teruglevering aan het net|Afname van het net/);
});

test('Net-pagina: kritieke tegenstrijdigheid ⇒ geen richting, rode toon, ruwe waarde alleen in diagnose',()=>{
 const r=grid({net:-1880,pv:4820,house:2500,ev:1480});
 assert.equal(r.model.critical,true);
 assert.equal(r.value,'1,88 kW');
 assert.equal(r.label,'P1-meting · richting niet bevestigd (meetketen tegenstrijdig)');
 assert.equal(r.direction,'unconfirmed');
 assert.equal(r.tone,'bad');
 assert.equal(r.meta['Ruwe P1-sensorwaarde (ondertekend)'],'-1880 W');
 assert.match(r.meta['Meetketen'],/^Controle nodig · Wijkt /);
 assert.doesNotMatch(r.html,new RegExp(MINUS+'1,88|Teruglevering aan het net'));
});

test('Net-pagina: verouderde P1 ⇒ alleen de grootte (vertraagd) of een streepje, nooit een richting',()=>{
 const late=grid({net:-1880,pv:4820,house:1460,ev:1480},{net:120});   // tussen route-TTL (60 s) en toon-TTL (300 s)
 assert.equal(late.model.readings.net.state,'recent');
 assert.equal(late.value,'1,88 kW');
 assert.match(late.label,/^Niet live · bevestigd /);
 assert.equal(late.direction,'none');
 assert.match(late.meta['Bevestigde richting'],/^Onbekend \(Niet live/);
 assert.equal(late.meta['Ruwe P1-sensorwaarde (ondertekend)'],'-1880 W');
 assert.doesNotMatch(late.html,new RegExp(MINUS+'1,88|Teruglevering aan het net'));
 const old=grid({net:-1880,pv:4820,house:1460,ev:1480},{net:900});  // ouder dan de toon-TTL
 assert.equal(old.value,'—');
 assert.match(old.label,/^Verouderd · /);
 assert.equal(old.direction,'none');
});

test('Net-pagina: 0 W ⇒ "0 W" zonder teken, in balans, geen bevestigde richting',()=>{
 const r=grid({net:0,pv:0,house:0,ev:0});
 assert.equal(r.value,'0 W');
 assert.equal(r.label,'In balans');
 assert.equal(r.direction,'none');
 assert.equal(r.meta['Bevestigde richting'],'Geen: in balans (onder 40 W)');
 assert.equal(r.meta['Ruwe P1-sensorwaarde (ondertekend)'],'0 W');
 const neg=grid({net:-0.4,pv:0,house:0,ev:0});
 assert.equal(neg.value,'0 W','geen −0 W');
});

test('Net-pagina: dode band volgt het vorige cockpitmodel (zelfde richting als de Home-tegel)',()=>{
 const prev=grid({net:1500,pv:0,house:1500,ev:0}).model;
 const r=grid({net:60,pv:0,house:60,ev:0},{},prev);
 assert.equal(r.value,'60 W');assert.equal(r.label,'Afname van het net');assert.equal(r.direction,'import');
 const cold=grid({net:60,pv:0,house:60,ev:0});
 assert.equal(cold.label,'In balans','zonder voorgeschiedenis geen richting in de dode band');
});

test('Net-pagina: de bron gebruikt netPresentation, niet langer tiles.net.value voor de hoofdweergave',()=>{
 const src=read('src/legacy/17-live-immersive.js');
 assert.match(src,/M\.netPresentation\(m\)/);
 assert.match(src,/if\(view==='grid'\)\{\s*const nv=ehImmNetView\(/);
});
