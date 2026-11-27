'use strict';
// Live batterijdashboard (Energie › Batterij) in de echte bundel, zonder browser.
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const NOW=Date.parse('2026-11-20T12:30:00Z');
class FakeDate extends Date{constructor(...a){if(a.length)super(...a);else super(NOW);}static now(){return NOW;}}
const registry=new Map();
const ctx={console,Date:FakeDate,Math,Map,Set,Array,Object,Number,String,JSON,Intl,
 window:{customCards:[],navigator:{onLine:true},addEventListener(){}},
 customElements:{get:n=>registry.get(n),define:(n,x)=>registry.set(n,x)},
 HTMLElement:class{attachShadow(){this.shadowRoot={innerHTML:'',addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};return this.shadowRoot;}}};
vm.runInNewContext(source+'\n;globalThis.API={ehBlHtml,EHNV_SEGMENTS};',ctx);
const {ehBlHtml,EHNV_SEGMENTS}=ctx.API;
const text=h=>h.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ');
const st=(s,u,ageMin=2)=>({state:String(s),attributes:{unit_of_measurement:u},last_updated:new Date(NOW-ageMin*60000).toISOString()});
function card(states,pts,extra={}){
 return {_hass:{states},config:{battery_soc:'sensor.soc',battery_soc_kwh:'sensor.kwh',...(extra.config||{})},_ehBl:pts?{kwhPoints:pts}:extra.bl};
}
const m=i=>NOW-i*60000;

test('segment Batterij staat in Energie en toont het dashboard bovenaan',()=>{
 const seg=EHNV_SEGMENTS.energy.find(s=>s.id==='battery');
 assert.equal(typeof seg.injectTop,'function');assert.equal(EHNV_SEGMENTS.energy.length,4);
});

test('laden: stand, vermogen uit kWh-verandering, resterende tijd en SIMULATIE-label',()=>{
 const html=ehBlHtml(card({'sensor.soc':st(60,'%'),'sensor.kwh':st(6,'kWh')},[{t:m(30),v:5.5},{t:m(0),v:6}]));
 const t=text(html);
 assert.match(t,/SIMULATIE/);assert.match(t,/60%/);assert.match(t,/6,0 kWh van 10 kWh/);
 assert.match(t,/Laadt 1\.000 W/);assert.match(t,/Vol over 4 u/);assert.match(t,/Afgeleid uit de verandering van de kWh-stand over 30 min/);
});

test('ontladen: levert terug in watt en tijd tot leeg',()=>{
 const t=text(ehBlHtml(card({'sensor.soc':st(50,'%'),'sensor.kwh':st(5,'kWh')},[{t:m(30),v:5.5},{t:m(0),v:5}])));
 assert.match(t,/Levert 1\.000 W terug/);assert.match(t,/Leeg over 5 u/);
});

test('gemeten sensor gaat voor en eenheid kW wordt omgerekend; tekenomkering werkt',()=>{
 const base={'sensor.soc':st(50,'%'),'sensor.kwh':st(5,'kWh'),'sensor.pw':st(-2.5,'kW')};
 assert.match(text(ehBlHtml(card(base,null,{config:{battery_power:'sensor.pw'}}))),/Levert 2\.500 W terug.*Gemeten door sensor sensor\.pw/);
 assert.match(text(ehBlHtml(card(base,null,{config:{battery_power:'sensor.pw',battery_power_sign:'discharge_positive'}}))),/Laadt 2\.500 W/);
});

test('oude laatste wijziging: rust, geen verouderd vermogen',()=>{
 const t=text(ehBlHtml(card({'sensor.soc':st(50,'%'),'sensor.kwh':st(5,'kWh')},[{t:m(400),v:4.5},{t:m(300),v:5}])));
 assert.match(t,/In rust/);assert.match(t,/Geen verandering van de kWh-stand sinds 5 u/);assert.doesNotMatch(t,/Vol over|Leeg over/);
});

test('zonder historie: vermogen onbekend, nooit 0 W verzonnen',()=>{
 const t=text(ehBlHtml(card({'sensor.soc':st(50,'%'),'sensor.kwh':st(5,'kWh')},null,{bl:{loading:false}})));
 assert.match(t,/Vermogen onbekend/);assert.doesNotMatch(t,/In rust/);assert.match(t,/Vandaag geladen — /);
});

test('sensor ontbreekt of is onbekend: duidelijke melding zonder cijfers',()=>{
 const t=text(ehBlHtml(card({'sensor.soc':st('unavailable','%')},null)));
 assert.match(t,/niet beschikbaar of heeft geen waarde/);assert.doesNotMatch(t,/kWh van/);
});

test('verouderde gegevens geven een waarschuwing',()=>{
 assert.match(text(ehBlHtml(card({'sensor.soc':st(50,'%',300),'sensor.kwh':st(5,'kWh',300)},null))),/niet bijgewerkt/);
});

test('grafiek per uur met tik-bubbel en toegankelijke samenvatting',()=>{
 const pts=Array.from({length:30},(_,i)=>({t:NOW-(30-i)*3600000,v:3+((i%10)/2)}));
 const html=ehBlHtml(card({'sensor.soc':st(50,'%'),'sensor.kwh':st(5,'kWh')},pts));
 assert.match(html,/data-ehqt-chart/);assert.match(html,/aria-label="Vulling van de batterij per uur, laatste 24 uur: gemiddeld \d+ procent"/);
 assert.equal((html.match(/<rect class="ehqt-(low|mid|high)/g)||[]).length,24);
});

test('alleen lezen: geen callService in het fragment',()=>{
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..','src','legacy','21-battery-live.js'),'utf8'),/callService/);
});
