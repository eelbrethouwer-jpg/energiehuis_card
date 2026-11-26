'use strict';
// v1.33.1: de tegel Huis op Home toont het huisverbruik exclusief praktijkruimte zodra die echt gemeten wordt.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const fragment=fs.readFileSync(path.join(__dirname,'..','src','legacy','16-live-cockpit.js'),'utf8');
function load(){
 class EnergiehuisCard{_render(){}}
 const ctx=vm.createContext({EnergiehuisCard,URL,Promise,setTimeout,clearTimeout,Date,JSON,Object,Math,Number,String,Array,Set,Map,Error});
 vm.runInContext(fragment+'\n;globalThis.__api=EhLiveCockpit;',ctx,{filename:'16-live-cockpit.js'});
 return ctx.__api.scope;
}
const NOW=Date.parse('2026-11-26T08:00:00Z');
const st=(id,v)=>({entity_id:id,state:String(v),attributes:{unit_of_measurement:'W'},last_updated:new Date(NOW-2000).toISOString(),last_changed:new Date(NOW-2000).toISOString(),last_reported:new Date(NOW-2000).toISOString()});
function model(v,cfg){
 const {EhPve04Model:M,EhHaAdapter:A}=load();
 const a=A.createAdapter(cfg);
 const states={
  'sensor.p1_meter_vermogen':st('sensor.p1_meter_vermogen',v.net),
  'sensor.goodwe_pv_power':st('sensor.goodwe_pv_power',v.pv),
  'sensor.energiehuis_huisverbruik_exclusief_auto':st('sensor.energiehuis_huisverbruik_exclusief_auto',v.house),
  'sensor.alfen_actief_vermogen_totaal':st('sensor.alfen_actief_vermogen_totaal',v.ev)};
 if(v.prak!==undefined)states['sensor.prak']=st('sensor.prak',v.prak);
 return M.computeModel(a.input({connected:true,states},NOW));
}
test('Huis toont de rest zonder praktijk: Huis + Praktijk + Cupra = Net + zon',()=>{
 const m=model({net:5020,pv:90,house:5050,ev:0,prak:2100},{praktijk:'sensor.prak'});
 assert.match(m.tiles.house.value,/2[,.]9\d? kW/);
 assert.equal(m.tiles.house.sub,'Verbruik excl. Cupra en praktijk');
 assert.match(m.tiles.practice.value,/2[,.]10 kW/);
});
test('zonder praktijkmeting blijft Huis het totaal; praktijk groter dan huis is een meetfout',()=>{
 const m=model({net:5020,pv:90,house:5050,ev:0});
 assert.match(m.tiles.house.value,/5[,.]05 kW/);
 assert.equal(m.tiles.house.sub,'Verbruik excl. Cupra');
 const bad=model({net:5020,pv:90,house:1000,ev:0,prak:2100},{praktijk:'sensor.prak'});
 assert.equal(bad.tiles.house.value,'—');
 assert.equal(bad.tiles.house.tone,'bad');
});
