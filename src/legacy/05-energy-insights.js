/* Energiehuis v1.8.0 — Energy Insights & Cost Control.
 * Additive analytics only: no new service calls, no changes to Alfen or physical meters.
 * All extensions use the original HA Recorder, HA state and cached read-only data.
 */
const EH18_CONTRACT_START = Date.parse('2026-11-01T00:00:00+01:00');
const EH18_CHOICES = [['today','Vandaag'],['yesterday','Gisteren'],['7d','7 dagen'],['30d','30 dagen'],['year','Dit jaar'],['prevyear','Vorig jaar']];
function eh18Unit(value,id,h,kind) {
 const unit=String(h?.states?.[id]?.attributes?.unit_of_measurement||'').replace(/\s/g,'').toLowerCase();
 const number=ehNum(value);
 if(number===null)return null;
 if(kind==='gas')return ['m³','m3','m^3'].includes(unit)?number:unit==='l'?number/1000:null;
 return unit==='kwh'?number:unit==='wh'?number/1000:null;
}
function eh18Period(card,type) {return card._eh18Periods?.[type]||'7d';}
function eh18Rows(stats,bins,step,c,h,type) {
 const id=type==='gas'?c.gas:type==='sun'?(c.pv_total_energy||c.zonne_energie):null;
 const ids=type==='gas'?[id]:[id,c.export,c.import];
 const counters=ehCountersByWindow(stats,[...new Set(ids.filter(Boolean))],bins,step,h);
 return bins.map(bin=>{
   const raw=key=>key?counters[key]?.totals.get(bin.key):null;
   const total=eh18Unit(raw(id),id,h,type==='gas'?'gas':'energy');
   const exportKwh=type==='sun'?eh18Unit(raw(c.export),c.export,h,'energy'):null;
   const importKwh=type==='sun'?eh18Unit(raw(c.import),c.import,h,'energy'):null;
   const selfKwh=total!==null&&exportKwh!==null&&exportKwh<=total+.02?Math.max(0,total-exportKwh):null;
   return {t:bin.t,label:bin.label,kwh:type==='sun'?total:null,m3:type==='gas'?total:null,exportKwh,importKwh,selfKwh};
 });
}
function eh18Snapshot(h,c,kind) {
 if(kind==='gas')return eh18Unit(h?.states?.[c.gas_today]?.state,c.gas_today,h,'gas');
 const pv=eh18Unit(h?.states?.[c.zonne_energie]?.state,c.zonne_energie,h,'energy');
 return pv;
}
function eh18Graphic(rows,kind,selected) {
 const field=kind==='gas'?'m3':'kwh', valid=rows.map((r,i)=>({i,v:r[field],label:r.label,t:r.t})).filter(x=>Number.isFinite(x.v));
 if(!valid.length)return '<p class="subtle">Geen betrouwbare langetermijnstatistieken voor deze periode. De live-sensoren blijven beschikbaar.</p>';
 const max=Math.max(0.1,...valid.map(x=>x.v)), W=640,H=172,L=43,R=15,T=10,B=29;
 const width=W-L-R,height=H-T-B,scale=(v)=>T+height-(v/max)*height;
 const x=i=>L+(rows.length<=1?.5:i/(rows.length-1))*width;
 const pts=valid.map(r=>x(r.i).toFixed(1)+','+scale(r.v).toFixed(1)).join(' ');
 const circles=valid.map(p=>'<circle tabindex="0" role="button" aria-label="'+ehEsc(p.label+' '+ehFmt(p.v,2))+'" data-eh18-series="'+kind+'" data-eh18-point="'+p.i+'" cx="'+x(p.i).toFixed(1)+'" cy="'+scale(p.v).toFixed(1)+'" r="'+(selected===p.i?6:4)+'" fill="'+(selected===p.i?'#ffe19a':'#56dcb8')+'" stroke="#0a2335" stroke-width="2"><title>'+ehEsc(p.label+': '+ehFmt(p.v,2)+(kind==='gas'?' m³':' kWh'))+'</title></circle>').join('');
 return '<svg class="eh18-chart" role="group" aria-label="Interactieve '+(kind==='gas'?'gasverbruik':'zonneopwek')+' grafiek" viewBox="0 0 '+W+' '+H+'"><line x1="'+L+'" x2="'+(W-R)+'" y1="'+scale(0)+'" y2="'+scale(0)+'" stroke="#9fbccc55"/><text x="3" y="'+(T+8)+'" fill="#a6c2d1" font-size="12">'+ehFmt(max,1)+'</text><text x="3" y="'+scale(0)+'" fill="#a6c2d1" font-size="12">0</text><polyline points="'+pts+'" fill="none" stroke="#50dda9" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>'+circles+'</svg><p class="subtle">Tik op een punt voor de exacte meetperiode en waarde.</p>';
}
function eh18Insight(card,h,c,kind) {
 const period=eh18Period(card,kind), state=card._eh18Results?.[kind],ready=state?.period===period;
 const periodButtons=EH18_CHOICES.map(([id,label])=>'<button type="button" data-eh18-period="'+id+'" data-eh18-series="'+kind+'" class="'+(period===id?'chosen':'')+'">'+label+'</button>').join('');
 const title=kind==='gas'?'Gas Insights':'Zonne-energie Insights';
 const live=eh18Snapshot(h,c,kind);
 const rows=ready?state.rows||[]:[],field=kind==='gas'?'m3':'kwh',known=rows.filter(x=>Number.isFinite(x[field]));
 const sum=known.reduce((s,x)=>s+x[field],0),complete=!!rows.length&&known.length===rows.length;
 const current=period==='today'&&live!==null?live:complete?sum:null;
 const selectedIndex=card._eh18Selected?.[kind]??(rows.length-1);
 const selected=rows[selectedIndex];
 const direct=kind==='sun'&&complete&&rows.every(x=>Number.isFinite(x.selfKwh))?rows.reduce((s,x)=>s+x.selfKwh,0):null;
 const exported=kind==='sun'&&complete&&rows.every(x=>Number.isFinite(x.exportKwh))?rows.reduce((s,x)=>s+x.exportKwh,0):null;
 const imported=kind==='sun'&&complete&&rows.every(x=>Number.isFinite(x.importKwh))?rows.reduce((s,x)=>s+x.importKwh,0):null;
 const quality=ready&&state.error?'<p class="eh18-note">'+ehEsc(state.error)+'</p>':!ready?'<p class="subtle">Recorder-historie wordt opgehaald…</p>':!complete?'<p class="subtle">Onvolledige historische dekking: alleen beschikbare punten worden getoond.</p>':'<p class="subtle">Berekend uit Recorder-statistieken.</p>';
 const main='<div class="eh18-kpi"><div><small>'+ (kind==='gas'?'Verbruik':'Opwek')+'</small><strong>'+ (current===null?'—':ehFmt(current,2)+' '+(kind==='gas'?'m³':'kWh'))+'</strong></div>'+ (kind==='sun'?'<div><small>Direct gebruikt</small><strong>'+(direct===null?'—':ehFmt(direct,2)+' kWh')+'</strong></div><div><small>Teruggeleverd</small><strong>'+(exported===null?'—':ehFmt(exported,2)+' kWh')+'</strong></div><div><small>Zelfverbruik</small><strong>'+(direct!==null&&sum>0?ehFmt(100*direct/sum,0)+'%':'—')+'</strong></div><div><small>Netafname</small><strong>'+(imported===null?'—':ehFmt(imported,2)+' kWh')+'</strong></div>':'')+'</div>';
 const detail=selected&&Number.isFinite(selected[field])?'<p class="eh18-selected"><strong>'+ehEsc(selected.label)+'</strong> '+ehFmt(selected[field],2)+(kind==='gas'?' m³':' kWh')+'</p>':'';
 const source=kind==='gas'?'Bron: '+c.gas+' / '+c.gas_today:'Bron: '+(c.pv_total_energy||c.zonne_energie)+' / '+c.export+' / '+c.import;
 return '<section class="subsection eh18-panel"><h3>'+ehIcon(kind==='gas'?'gas':'sun')+' '+title+'</h3><div class="eh18-periods">'+periodButtons+'</div>'+main+quality+(ready?eh18Graphic(rows,kind,selectedIndex):'')+detail+'<p class="subtle">'+ehEsc(source)+'</p>'+(kind==='sun'?'<p class="subtle">Direct zelfverbruik = zonneopwek min netteruglevering, alleen als beide meters over dezelfde tijdvakken bruikbaar zijn. Het aandeel van de auto kan niet zonder extra synchronisatie betrouwbaar worden vastgesteld.</p>':'<p class="subtle">Gasverbruik in m³; gasprijzen van Engie ontbreken totdat een kostensensor of tarief is gekoppeld.</p>')+'</section>';
}
function eh18Health(h,c){
 const def=[['Gas dag',c.gas_today,'m³'],['Gas totaal',c.gas,'m³'],['Zonne-energie dag',c.zonne_energie,'kWh'],['Netimport',c.import,'kWh'],['Netexport',c.export,'kWh']];
 const issues=[];
 for(const [name,id,unit] of def){
  const st=h?.states?.[id],value=ehNum(st?.state);
  if(!id||!st)issues.push(name+': sensor ontbreekt');
  else if(value===null)issues.push(name+': geen numerieke waarde');
  else if(!Number.isFinite(eh18Unit(value,id,h,name.startsWith('Gas')?'gas':'energy')))issues.push(name+': controleer de eenheid ('+unit+')');
 }
 const pv=ehW(h,c.zonnepanelen),net=ehW(h,c.net),ev=ehW(h,c.laden),house=ehW(h,c.huis);
 if([pv,net,ev,house].every(Number.isFinite) && Math.abs((pv+net-ev)-house)>1000)issues.push('Vermogensbalans wijkt meer dan 1 kW af (momentopname, controleer gelijktijdigheid sensoren).');
 return issues;
}
function eh18Costs(h,c){
 const current=ehRead(h,c.cost_zonneplan_month),gas=c.gas_cost_month?ehRead(h,c.gas_cost_month):null;
 const fixed=ehNum(c.budget_other_month_eur),now=Date.now(),started=now>=EH18_CONTRACT_START;
 const coverage=started?'Zonneplan-contractperiode actief vanaf 1 november 2026.':'Zonneplan begint 1 november 2026. Oudere cijfers zijn geen gerealiseerde Zonneplan-factuur.';
 const target=ehNum(c.monthly_budget_eur)??200;
 return '<section class="subsection eh18-panel"><h3>'+ehIcon('euro')+' Kosten & besparing · databronnen</h3><div class="eh18-kpi"><div><small>Stroom deze maand</small><strong>'+(started&&current!==null?ehEuro2(current):'—')+'</strong></div><div><small>Gas via Engie</small><strong>'+(gas===null?'Nog niet gekoppeld':ehEuro2(gas))+'</strong></div><div><small>Maanddoel</small><strong>'+ehEuro2(target)+'</strong></div></div><p class="eh18-note">'+ehEsc(coverage)+'</p><p class="subtle">Stroomkosten zijn alleen zo compleet als de gekoppelde kostensensor. Inclusief vaste tarieven en belastingen uitsluitend wanneer deze in de bronsensor zijn inbegrepen. Leveranciersvergelijking, slimme timing en virtuele batterij blijven afzonderlijke vergelijkingen: nooit optellen als één gerealiseerde besparing.</p><p class="subtle">Volledige budgetbeoordeling vereist de actuele Engie-kosten en alle vaste kosten'+(fixed===null?' (nog onbekend).':'. Ingestelde overige kosten: '+ehEuro2(fixed)+'.')+'</p></section>';
}
function eh18Charge(h,c,card) {
 if(card._view!=='charge')return '';
 const soc=ehRead(h,c.cupra),capacity=eh17N(c.cupra_usable_kwh)||59;
 const need=card._simNeed??(soc!==null?Math.max(0,(card._targetSoc-soc)/100*capacity):eh17N(c.sim_laadbehoefte_kwh)||30);
 const tr=ehPricesForDay(h,c,new Date()),prices=ehHourlyFromPrices(tr.quarters,tr.hourly.length?tr.hourly:ehForecast(h,c.prijs));
 const house=ehW(h,c.huis),requested=card._simPower??eh17N(c.sim_laadvermogen_kw)??3.7;
 const opts={fuseAmp:eh17N(c.fuse_amp)??40,chargerAmp:eh17N(c.charger_amp)??32,reserveAmp:eh17N(c.reserve_amp)??2,houseW:house,efficiency:eh17N(c.ev_charge_efficiency)??.9,solar:eh17Solar(h,c.pv_forecast),exportCompensation:eh17N(c.export_compensation_eur_kwh)};
 const best=eh17Plan(prices,new Date(),card._departure,need,requested,'slim',opts);
 const complete=best.remaining<=.05&&!best.error;
 const rows=(best.selected||[]).map(s=>'<tr><td>'+ehEsc(new Date(s.t).toLocaleString('nl-NL',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}))+'</td><td>'+ehEuro2(s.price)+'/kWh</td><td>'+ehFmt(s.kWh,2)+' kWh</td></tr>').join('');
 const status=need<=.05?'Accu heeft het ingestelde laaddoel al bereikt.':best.error||(!complete?'Niet volledig haalbaar vóór vertrek; resterend '+ehFmt(best.remaining,2)+' kWh.':'Geplande lading kan binnen de beschikbare volledige prijsuren worden ingepland.');
 return '<details class="cupra-card eh18-panel eh32-feasibility"><summary>Haalbaarheid en vermogensgrenzen</summary><p class="eh18-note">'+ehEsc(status)+'</p><p class="subtle">Rekenmodel: 1×'+ehFmt(opts.fuseAmp,0)+' A, lader maximaal '+ehFmt(opts.chargerAmp,0)+' A, reserve '+ehFmt(opts.reserveAmp,0)+' A, '+(house===null?'aangenomen huisvermogen 2 kW':'momentaan huisvermogen '+ehFmt(house/1000,1)+' kW')+'. Alfen Active Load Balancing blijft leidend; géén laadcommando’s.</p></details>';
}
function eh18Css() {
 return '.eh18-panel{margin-top:13px}.eh18-panel h3{display:flex;align-items:center;gap:8px;font-size:16px;margin:0 0 12px}.eh18-panel h3 .icon{width:20px;height:20px}.eh18-periods{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px}.eh18-periods button{border:1px solid #668ea45c;background:#102b3e;border-radius:9px;color:#e2f3fa;font-size:11px;padding:9px;cursor:pointer}.eh18-periods button.chosen{border-color:#4bdaad;background:#15483a}.eh18-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px}.eh18-kpi>div{min-width:0;border:1px solid #6b95ae44;background:#0b2639;border-radius:11px;padding:12px;display:flex;flex-direction:column;gap:5px}.eh18-kpi small{color:#b4cad6;font-size:11px}.eh18-kpi strong{color:#edfff6;font-size:19px;overflow-wrap:anywhere}.eh18-note{border-left:3px solid #ffca77;padding:8px 11px;font-size:12px;background:#ffce6d11;line-height:1.5}.eh18-selected{font-size:12px;border-left:3px solid #56dcb8;padding:6px 10px}.eh18-chart{width:100%;min-height:130px;height:auto;margin-top:13px}.eh18-chart circle{cursor:pointer}.eh18-chart circle:focus-visible{stroke:#fff;stroke-width:4}.eh18-tablewrap{overflow-x:auto}.eh18-table{width:100%;border-collapse:collapse;font-size:12px}.eh18-table td,.eh18-table th{padding:10px 5px;border-bottom:1px solid #ffffff24;text-align:left}.eh18-table th{color:#b4cad6}@media(max-width:550px){.body{padding-left:10px!important;padding-right:10px!important}.metrics{gap:7px!important}.metric{padding:10px 9px!important;min-height:78px!important;gap:7px!important}.metric-symbol{width:31px!important;height:31px!important}.metric-symbol .icon{width:28px!important;height:28px!important}.metric-value{font-size:19px!important;margin-top:4px!important}.hero{height:215px!important}.title{font-size:29px!important}.eh18-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}.eh18-kpi strong{font-size:16px}}';
}
(function eh18Install(){
 const P=EnergiehuisCard.prototype,oldMore=P._moreHtml,oldCosts=P._costsHtml,oldCupra=P._cupraHtml,oldRender=P._render;
 P._eh18Load=async function(type) {
  if(!this.isConnected||!this._hass?.callWS||!this.config)return;
  const period=eh18Period(this,type),key=type+'|'+period+'|'+ehDayKey(new Date());
  this._eh18Cache=this._eh18Cache||new Map();
  const cached=this._eh18Cache.get(key);
  if(cached&&Date.now()-cached.at<5*60000){this._eh18Results=this._eh18Results||{};this._eh18Results[type]=cached;return;}
  this._eh18Loading=this._eh18Loading||new Set();
  if(this._eh18Loading.has(key))return;
  this._eh18Loading.add(key);
  const h=this._hass,c=this.config,lim=ehPeriodLimits(period,new Date());
  const ids=type==='gas'?[c.gas]:[c.pv_total_energy||c.zonne_energie,c.import,c.export];
  try{
   const from=new Date(lim.from.getTime()-36*3600000);
   const stats=await h.callWS({type:'recorder/statistics_during_period',start_time:from.toISOString(),end_time:lim.to.toISOString(),statistic_ids:[...new Set(ids.filter(Boolean))],period:lim.step,types:['change','sum']});
   const bins=ehWindows(lim),rows=eh18Rows(stats,bins,lim.step,c,h,type);
   const out={period,rows,at:Date.now(),error:null};
   this._eh18Cache.set(key,out);this._eh18Results=this._eh18Results||{};
   if(eh18Period(this,type)===period)this._eh18Results[type]=out;
   if(this._eh18Cache.size>15)this._eh18Cache.delete(this._eh18Cache.keys().next().value);
  }catch(e){
   this._eh18Results=this._eh18Results||{};
   if(eh18Period(this,type)===period)this._eh18Results[type]={period,rows:[],at:Date.now(),error:'Recorder-historie voor '+type+' is niet beschikbaar.'};
  }finally{this._eh18Loading.delete(key);if(this.isConnected)this._schedule();}
 };
 P._moreHtml=function(h,c){
  const original=oldMore.call(this,h,c);
  const issues=eh18Health(h,c);
  const status='<section class="subsection eh18-panel"><h3>'+ehIcon('shield')+' Datakwaliteit · extra controles</h3>'+(issues.length?'<div class="eh18-note">'+issues.map(e=>'<p>'+ehEsc(e)+'</p>').join('')+'</div>':'<p class="subtle">Geen extra problemen herkend in de beschikbare sensorwaarden.</p>')+'<p class="subtle">HomeWizard-watermeter: aansluiten in een volgende versie; dit is geen foutmelding.</p></section>';
  if(this.isConnected){this._eh18Load('gas');this._eh18Load('sun');}
  return original.replace('</main>',eh18Insight(this,h,c,'gas')+eh18Insight(this,h,c,'sun')+status+'</main>');
 };
 P._costsHtml=function(h,c){return oldCosts.call(this,h,c).replace('</main>',eh18Costs(h,c)+'</main>');};
 P._cupraHtml=function(h,c){return oldCupra.call(this,h,c).replace('</main>',eh18Charge(h,c,this)+'</main>');};
 P._render=function(){
  oldRender.call(this);
  const root=this.shadowRoot;if(!root||!this.config||!this._hass)return;
  const style=root.querySelector('style');
  if(style&&!style.textContent.includes('.eh18-panel{'))style.textContent+='\n'+eh18Css();
  if(this._eh18ListenerAttached)return;
  this._eh18ListenerAttached=true;
  const onSelect=e=>{
   const btn=e.target?.closest?.('[data-eh18-period],[data-eh18-point]');
   if(!btn)return;
   const kind=btn.dataset.eh18Series;if(!['gas','sun'].includes(kind))return;
   if(btn.dataset.eh18Period){
    const p=btn.dataset.eh18Period;
    if(!EH18_CHOICES.some(x=>x[0]===p))return;
    this._eh18Periods=this._eh18Periods||{};this._eh18Periods[kind]=p;
    this._eh18Selected=this._eh18Selected||{};delete this._eh18Selected[kind];
    this._schedule();this._eh18Load(kind);
   }else if(btn.dataset.eh18Point!==undefined){
    this._eh18Selected=this._eh18Selected||{};this._eh18Selected[kind]=Number(btn.dataset.eh18Point);
    this._schedule();
   }
  };
  root.addEventListener('click',onSelect);
  root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target?.matches?.('circle[data-eh18-point]')){e.preventDefault();onSelect(e);}});
 };
})();


