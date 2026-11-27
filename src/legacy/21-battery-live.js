// Energiehuis 3.7: live batterijdashboard (Energie › Batterij). De batterij is een SIMULATIE in Home Assistant:
// hoe vol hij is, wat hij laadt of teruglevert in watt, wat er vandaag is geladen en teruggeleverd en het verloop van de laatste 24 uur.
// Alleen lezen: geen servicecalls, geen opslag. Vermogen komt uit een optionele sensor (battery_power) of wordt afgeleid uit de
// verandering van de kWh-stand (zuivere functies in battery-live-engine.cjs).
const EHBL_FIXED_KWH = 10;

function ehBlDur(min){
 if(!Number.isFinite(min)||min<0)return '';
 if(min<60)return Math.max(1,Math.round(min))+' min';
 const h=Math.floor(min/60),m=Math.round(min%60);
 if(h>=48)return Math.round(h/24)+' dagen';
 return h+' u'+(m?' '+m+' min':'');
}
function ehBlWatts(w){return ehFmt(Math.abs(w),0)+' W';}
function ehBlPowerSource(card){
 const h=card._hass,c=card.config||{},st=c.battery_power&&h?.states?.[c.battery_power];
 if(st){
  const n=ehBlNum(st.state);
  if(n!==null){
   const u=String(st.attributes?.unit_of_measurement||'W').toLowerCase();
   const w=u==='kw'?n*1000:u==='mw'?n*1e6:n;
   return {watts:c.battery_power_sign==='discharge_positive'?-w:w,measured:true,spanMin:null,staleMin:null};
  }
 }
 const e=card._ehBl;
 if(e&&Array.isArray(e.kwhPoints)){
  const d=ehBlDerivePower(e.kwhPoints,Date.now());
  // Is de laatste wijziging ouder dan 30 minuten, dan staat de batterij stil: toon rust, geen verouderd vermogen.
  if(d)return d.staleMin>30?{watts:0,measured:false,spanMin:null,staleMin:d.staleMin,still:true}:{watts:d.watts,measured:false,spanMin:d.spanMin,staleMin:d.staleMin};
 }
 return {watts:null,measured:false,spanMin:null,staleMin:null};
}
function ehBlRing(soc,level){
 const r=52,C=2*Math.PI*r,pct=Math.max(0,Math.min(100,soc)),dash=(C*pct/100).toFixed(1);
 return `<svg class="ehbl-ring" viewBox="0 0 130 130" role="img" aria-label="Batterij ${Math.round(pct)} procent vol"><circle class="ehbl-track" cx="65" cy="65" r="${r}"/><circle class="ehbl-arc ehbl-${level}" cx="65" cy="65" r="${r}" stroke-dasharray="${dash} ${C.toFixed(1)}" transform="rotate(-90 65 65)"/><text x="65" y="64" text-anchor="middle" class="ehbl-pct">${Math.round(pct)}%</text><text x="65" y="84" text-anchor="middle" class="ehbl-pctl">vol</text></svg>`;
}
function ehBlGauge(watts,maxW){
 if(!Number.isFinite(watts))return '';
 const half=50,frac=Math.max(-1,Math.min(1,watts/maxW)),w=Math.abs(frac)*half;
 const fill=frac>=0?`<rect class="ehbl-gf ehbl-gcharge" x="50" y="0" width="${w.toFixed(2)}" height="10"/>`:`<rect class="ehbl-gf ehbl-gdis" x="${(50-w).toFixed(2)}" y="0" width="${w.toFixed(2)}" height="10"/>`;
 return `<div class="ehbl-gauge" role="img" aria-label="Vermogen ${ehBlWatts(watts)} ${watts>=0?'laden':'ontladen'} op een schaal tot ${ehBlWatts(maxW)}"><svg viewBox="0 0 100 10" preserveAspectRatio="none"><rect class="ehbl-gt" x="0" y="0" width="100" height="10" rx="3"/>${fill}<line class="ehbl-g0" x1="50" x2="50" y1="-1" y2="11"/></svg><div class="ehbl-gl"><span>◀ ontlaadt (levert terug)</span><span>laadt ▶</span></div></div>`;
}
function ehBlHtml(card){
 const h=card._hass,c=card.config||{},now=new Date(),nowMs=now.getTime();
 const socId=c.battery_soc||c.batterij,kwhId=c.battery_soc_kwh;
 const stSoc=socId&&h?.states?.[socId],stKwh=kwhId&&h?.states?.[kwhId];
 const head='<div class="ehbl-head"><h3>Live batterij</h3><span class="ehbl-badge">SIMULATIE</span></div>';
 let soc=stSoc?ehBlNum(stSoc.state):null;
 const kwhNow=stKwh?ehBlNum(stKwh.state):null;
 if(soc===null&&kwhNow!==null)soc=Math.max(0,Math.min(100,kwhNow/EHBL_FIXED_KWH*100));
 if(soc===null)return `<section class="subsection ehbl" aria-label="Live batterij">${head}<p class="ehqt-warn" role="alert">De batterijsensor${socId?' <code>'+ehEsc(socId)+'</code>':''} is niet beschikbaar of heeft geen waarde. Er worden geen cijfers verzonnen.</p></section>`;
 const cap=ehBlCapacity(kwhNow,soc,EHBL_FIXED_KWH),kwh=kwhNow!==null?kwhNow:cap*soc/100,level=ehBlLevel(soc);
 const pw=ehBlPowerSource(card),mode=ehBlMode(pw.watts),maxW=Math.max(1000,(ehNum(c.battery_sim_power_kw)||3)*1000);
 const upd=Date.parse((stSoc&&stSoc.last_updated)||(stKwh&&stKwh.last_updated)||'');
 const ageMin=Number.isFinite(upd)?Math.max(0,Math.round((nowMs-upd)/60000)):null;
 const stale=ageMin!==null&&ageMin>90;
 const status=c.battery_status&&h?.states?.[c.battery_status]?.state;
 let powerTxt,powerCls,powerSub;
 if(mode==='charging'){powerTxt='Laadt '+ehBlWatts(pw.watts);powerCls='charging';}
 else if(mode==='discharging'){powerTxt='Levert '+ehBlWatts(pw.watts)+' terug';powerCls='discharging';}
 else if(mode==='idle'){powerTxt='In rust · '+ehBlWatts(pw.watts||0);powerCls='idle';}
 else{powerTxt='Vermogen onbekend';powerCls='unknown';}
 if(mode==='unknown')powerSub=card._ehBl&&card._ehBl.loading?'Geschiedenis ophalen…':'Er is (nog) geen verandering van de kWh-stand gemeten waaruit het vermogen te berekenen is.';
 else if(pw.still)powerSub='Geen verandering van de kWh-stand sinds '+ehBlDur(pw.staleMin)+'.';
 else powerSub=pw.measured?'Gemeten door sensor '+ehEsc(c.battery_power):'Afgeleid uit de verandering van de kWh-stand'+(pw.spanMin?' over '+pw.spanMin+' min':'')+(pw.staleMin>5?` (laatste wijziging ${pw.staleMin} min geleden)`:'');
 const eta=ehBlTimeTo(kwh,cap,pw.watts);
 const etaTxt=eta?(eta.to==='full'?'Vol over ':'Leeg over ')+ehBlDur(eta.minutes):'';
 const e=card._ehBl||{};
 const startDay=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
 const kwhSeries=e.kwhPoints&&e.kwhPoints.length?e.kwhPoints:null;
 const totals=kwhSeries?ehBlDayTotals(kwhSeries,startDay,nowMs):null;
 const saveDay=c.battery_saving_day?ehNum(h?.states?.[c.battery_saving_day]?.state):null;
 const tile=(k,v,sub)=>`<div class="ehqt-tile"><small>${ehEsc(k)}</small><strong>${ehEsc(v)}</strong><span>${ehEsc(sub)}</span></div>`;
 const approx=totals&&!totals.complete?'≥ ':'';
 const tiles=`<div class="ehqt-tiles">${tile('Vandaag geladen',totals?approx+ehFmt(totals.charged,2)+' kWh':'—',totals?(totals.complete?'uit de kWh-stand':'onvolledige historie'):'geen historie')}${tile('Vandaag teruggeleverd',totals?approx+ehFmt(totals.discharged,2)+' kWh':'—','aan het huis')}${tile('Besparing vandaag',saveDay===null?'—':ehEuro2(saveDay),'volgens het model')}</div>`;
 // Verloop laatste 24 uur (per uur), SOC in %.
 let chart='';
 const first=Math.floor(nowMs/3600000)*3600000-23*3600000;
 const socSeries=e.socPoints&&e.socPoints.length?e.socPoints:(kwhSeries?kwhSeries.map(p=>({t:p.t,v:p.v/cap*100})):null);
 if(socSeries){
  const hourly=ehBlHourly(socSeries,first,first+24*3600000);
  const items=hourly.map((x,i)=>x.v===null?null:{i,v:x.v,cls:'ehqt-'+({full:'low',good:'mid',low:'high',empty:'high',unknown:'mid'}[ehBlLevel(x.v)])+(i===23?' ehqt-now':''),tip:{time:ehQtTime(x.t)+'–'+ehQtTime(x.t+3600000),main:Math.round(x.v)+' % vol',sub:ehFmt(x.v/100*cap,1)+' kWh van '+ehFmt(cap,0)+' kWh'}}).filter(Boolean);
  if(items.length>=2){
   const vals=items.map(x=>x.v),avg=vals.reduce((a,v)=>a+v,0)/vals.length;
   chart=ehQtDrawChart({key:'b'+first,n:24,first,stepMs:3600000,xEvery:3,items,lo:0,hi:100,avg,fmt:v=>Math.round(v)+' %',hiName:'vol',nowMs:-1,hint:'Tik op een uur voor de vulling',label:`Vulling van de batterij per uur, laatste 24 uur: gemiddeld ${Math.round(avg)} procent`});
  }
 }
 const warn=[stale?`<p class="ehqt-warn">De batterijgegevens zijn ${ehBlDur(ageMin)} niet bijgewerkt.</p>`:'',e.error?`<p class="subtle">Geschiedenis niet beschikbaar: ${ehEsc(e.error)}</p>`:''].join('');
 return `<section class="subsection ehbl" aria-label="Live batterij">${head}
  <div class="ehbl-top">${ehBlRing(soc,level)}<div class="ehbl-info"><strong class="ehbl-kwh">${ehEsc(ehFmt(kwh,1))} kWh</strong><span>van ${ehEsc(ehFmt(cap,0))} kWh${status?' · '+ehEsc(status):''}</span><span class="ehbl-upd">${ageMin===null?'':'bijgewerkt '+(ageMin<1?'zojuist':ageMin+' min geleden')}</span></div></div>
  <div class="ehbl-power ehbl-p-${powerCls}"><div class="ehbl-pw"><strong>${ehEsc(powerTxt)}</strong>${etaTxt?`<span class="ehbl-eta">${ehEsc(etaTxt)}</span>`:''}</div><small>${powerSub}</small>${ehBlGauge(pw.watts,maxW)}</div>
  ${warn}${tiles}${chart}
  <p class="subtle">Virtuele batterij: een rekenmodel in Home Assistant, geen fysieke opslag. Alleen lezen.</p></section>`;
}
async function ehBlFetch(h,c,now){
 const ids=[c.battery_soc||c.batterij,c.battery_soc_kwh].filter((id,i,a)=>id&&h.states[id]&&a.indexOf(id)===i);
 if(!ids.length)throw new Error('Geen batterijsensor gevonden.');
 const iso=ms=>new Date(ms).toISOString(),from=now.getTime()-26*3600000;
 const res=await eh20WithTimeout(h.callWS({type:'history/history_during_period',start_time:iso(from),end_time:iso(now.getTime()),entity_ids:ids,include_start_time_state:true,significant_changes_only:false,minimal_response:true,no_attributes:true}),30000);
 const pts=id=>((res&&res[id])||[]).map(x=>({t:x.lu!==undefined?x.lu*1000:Date.parse(x.last_updated||x.last_changed||''),v:ehBlNum(x.s!==undefined?x.s:x.state)})).filter(p=>Number.isFinite(p.t)&&p.v!==null);
 return {socPoints:c.battery_soc||c.batterij?pts(c.battery_soc||c.batterij):[],kwhPoints:c.battery_soc_kwh?pts(c.battery_soc_kwh):[]};
}
function ehBlCss(){
 return [
  '/* EHBL BATTERIJ LIVE */',
  '.ehbl{background:linear-gradient(145deg,#0b293f,#071e33);border-radius:17px;padding:12px;margin-bottom:12px}',
  '.ehbl-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}.ehbl-head h3{margin:0;font-size:16px}',
  '.ehbl-badge{font-size:10px;font-weight:800;letter-spacing:.06em;color:#c9b8ff;border:1px solid #8f78ff88;border-radius:999px;padding:3px 8px}',
  '.ehbl-top{display:flex;gap:14px;align-items:center;margin:6px 0 10px}.ehbl-ring{width:112px;height:112px;flex:none}',
  '.ehbl-track{fill:none;stroke:#6d99b52e;stroke-width:12}.ehbl-arc{fill:none;stroke-width:12;stroke-linecap:round}',
  '.ehbl-full{stroke:#38e8a1}.ehbl-good{stroke:#61b7ff}.ehbl-low{stroke:#ffca44}.ehbl-empty,.ehbl-unknown{stroke:#ff8a6a}',
  '.ehbl-ring text{fill:#fff;font-family:inherit}.ehbl-pct{font-size:28px;font-weight:800}.ehbl-pctl{font-size:11px;fill:#9fbccd}',
  '.ehbl-info{display:grid;gap:2px}.ehbl-kwh{font-size:24px;line-height:1.1}.ehbl-info span{font-size:12px;color:#b9d2e0}.ehbl-upd{color:#8fb0c4!important;font-size:11px!important}',
  '.ehbl-power{border-radius:14px;padding:10px 12px;background:#0b2132;border:1px solid #6d99b52e;margin-bottom:10px}',
  '.ehbl-pw{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}.ehbl-pw strong{font-size:20px}.ehbl-eta{font-size:12px;color:#cfe3ef}',
  '.ehbl-p-charging strong{color:#7ff0c4}.ehbl-p-discharging strong{color:#ffc26b}.ehbl-p-idle strong,.ehbl-p-unknown strong{color:#cfe3ef}',
  '.ehbl-power small{display:block;font-size:11px;color:#9fbccd;margin:3px 0 8px;line-height:1.35}',
  '.ehbl-gauge svg{display:block;width:100%;height:14px}.ehbl-gt{fill:#143247}.ehbl-gcharge{fill:#38e8a1}.ehbl-gdis{fill:#ffb24a}.ehbl-g0{stroke:#fff;stroke-width:.8}',
  '.ehbl-gl{display:flex;justify-content:space-between;font-size:10px;color:#8fb0c4;margin-top:3px}',
  '.ehbl .ehqt-tiles{margin-top:2px}'
 ].join('\n');
}
(function ehBlInstall(){
 const P=EnergiehuisCard.prototype,previous=P._render,previousConfig=P.setConfig;
 P.setConfig=function(config){this._ehBl=null;return previousConfig.call(this,config);};
 P._render=function(){
  previous.call(this);
  const root=this.shadowRoot;
  if(!root)return;
  const style=root.querySelector('style');
  if(style&&!style.textContent.includes('/* EHBL BATTERIJ LIVE */'))style.textContent+='\n'+ehBlCss();
  if(this._view==='battery'&&this.isConnected)this._ehBlLoad();
 };
 P._ehBlLoad=async function(){
  const c=this.config||{},h=this._hass,e=this._ehBl;
  if(!h?.callWS||!c||(!(c.battery_soc||c.batterij)&&!c.battery_soc_kwh))return;
  if(e&&(e.loading||Date.now()-e.at<(e.error?120000:60000)))return;
  this._ehBl={...(e||{}),loading:true,at:Date.now()};
  try{
   const r=await ehBlFetch(h,c,new Date());
   this._ehBl={loading:false,at:Date.now(),kwhPoints:r.kwhPoints,socPoints:r.socPoints};
  }catch(err){
   this._ehBl={...(this._ehBl||{}),loading:false,at:Date.now(),error:String(err&&err.message==='eh20-timeout'?'Home Assistant antwoordde niet op tijd.':(err&&err.message)||'Ophalen mislukt.')};
  }
  this._schedule();
 };
})();
