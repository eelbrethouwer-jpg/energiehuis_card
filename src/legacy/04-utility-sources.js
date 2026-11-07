/* v1.7.1 utility sources and Recorder day totals (read-only) */
function eh171Unit(kind,raw){
 const u=String(raw||"").toLowerCase().replace(/\s/g,"");
 if(kind==="flow")return ["l/min","l/m","lpm","liter/min","liter/minuut"].includes(u)?"lpm":(["m³/h","m3/h"].includes(u)?"m3h":null);
 if(["m³","m3","m^3"].includes(u))return "m3";
 if(["l","liter","liters"].includes(u))return "l";
 return null;
}

function eh171M3(value,unit){
 const n=ehNum(value),u=eh171Unit("volume",unit);
 return n===null?null:u==="m3"?n:u==="l"?n/1000:null;
}

function eh171Flow(value,unit){
 const n=ehNum(value),u=eh171Unit("flow",unit);
 return n===null?null:u==="lpm"?n:u==="m3h"?n*1000/60:null;
}

function eh171Detect(h,c,group,kind){
 const explicit=group==="gas"?(kind==="today"?c.gas_today:c.gas):(kind==="today"?c.water_today:kind==="flow"?c.water_flow:c.water);
 if(explicit&&(!((group==="gas")&&(kind==="total")&&explicit==="sensor.gas_meter_gas"&&!h?.states?.[explicit])))return explicit;
 const found=[];
 for(const [id,st] of Object.entries(h?.states||{})){
   if(!id.startsWith("sensor."))continue;
   const label=(id+" "+(st?.attributes?.friendly_name||"")).toLowerCase();
   if(!label.includes(group==="gas"?"gas":"water"))continue;
   const val=ehNum(st.state),unit=st.attributes?.unit_of_measurement;
   if(val===null)continue;
   const day=/(today|dag|vandaag|daily|_24h)/.test(label);
   const total=/(meterstand|meter_reading|total|totaal|cumulative|_gas$|gas_meter_gas)/.test(label);
   if(kind==="flow"){
     if(!/(active|flow|debiet|actueel|current|water_usage_rate)/.test(label)||eh171Flow(val,unit)===null)continue;
   }else{
     if(eh171M3(val,unit)===null||/(kosten|cost|price|tarief|flow|debiet|active|rate)/.test(label))continue;
     if(kind==="today"&&!day||kind==="total"&&(day||!total))continue;
   }
   let score=(id.includes("watermeter")?6:0)+(id.includes("gas_meter")?6:0)+(id.includes("total_water_usage")?12:0)+(id.includes("active_water_usage")?12:0)+(id.includes("total")?5:0)+(st.attributes?.state_class==="total_increasing"?2:0);
   found.push({id,score});
 }
 found.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 return !found.length||found.length>1&&found[0].score===found[1].score?null:found[0].id;
}

function eh171Sources(h,c){
 return {gas:{total:eh171Detect(h,c,"gas","total"),today:eh171Detect(h,c,"gas","today")},
 water:{total:eh171Detect(h,c,"water","total"),today:eh171Detect(h,c,"water","today"),flow:eh171Detect(h,c,"water","flow")}};
}

function eh171DailyDelta(history,id,h,midnight){
 const rows=ehNumericHistory(history,id,h);
 const base=rows.filter(x=>x.t<=midnight).at(-1);
 if(!base||base.t<midnight-36*3600000)return {value:null,reason:"Recorder mist een beginstand vóór middernacht"};
 const current=h.states?.[id];
 const before=eh171M3(base.v,base.unit||current?.attributes?.unit_of_measurement),after=eh171M3(current?.state,current?.attributes?.unit_of_measurement);
 if(before===null||after===null)return {value:null,reason:"Meeteenheid ontbreekt of wordt niet ondersteund"};
 if(after-before<-.001)return {value:null,reason:"Tellerstand daalde; geen dagberekening mogelijk"};
 if(after-before>100)return {value:null,reason:"Onwaarschijnlijk groot dagverschil"};
 return {value:Math.max(0,after-before),reason:"Berekend vanaf Recorder-beginstand vóór middernacht"};
}

function eh171Read(card,h,c){
 const sources=eh171Sources(h,c),out={};
 for(const type of ["gas","water"]){
  const d=sources[type],isGas=type==="gas",meter=h?.states?.[d.total],day=h?.states?.[d.today],flow=h?.states?.[d.flow];
  const total=eh171M3(meter?.state,meter?.attributes?.unit_of_measurement);
  const manual=eh171M3(day?.state,day?.attributes?.unit_of_measurement);
  const validManual=manual!==null&&manual>=0&&manual<=100?manual:null;
  const historical=card?._eh171Daily && card._eh171Daily.key===card._eh171DailyKey ? card._eh171Daily.values?.[type] : null;
  const value=validManual!==null?validManual:historical?.value??null;
  const flowValue=eh171Flow(flow?.state,flow?.attributes?.unit_of_measurement);
  const meterText=total===null?"—":ehFmt(total,isGas?2:3)+" m³",today=value===null?"—":ehFmt(isGas?value:value*1000,isGas?2:0)+(isGas?" m³":" L");
  const source=validManual!==null?d.today:historical?.value!==null&&Number.isFinite(historical?.value)?"Recorder · "+d.total:null;
  out[type]={
   today,meter:meterText,flow:flowValue===null?"—":ehFmt(flowValue,1)+" L/min",source,
   totalId:d.total,todayId:d.today,flowId:d.flow,
   primary:value!==null?today:meterText,
   subtitle:value!==null?"Vandaag · "+(validManual!==null?"dagsensor":"Recorder"):total!==null?"Meterstand · dagverbruik nog niet beschikbaar":"Sensor niet gekoppeld",
   info:validManual!==null?"Dagwaarde uit aparte sensor":value!==null?"Dagtotaal uit Recorder-historie":d.total?(historical?.reason||card?._eh171Daily?.error||"Daghistorie wordt gecontroleerd"):"Geen herkenbare meter",
   note:isGas?"Gasupdates kunnen met vertraging binnenkomen.":"Dagverbruik in liters; totale meterstand in m³."
  };
 }
 return out;
}

function eh171Install(){
 const P=EnergiehuisCard.prototype,priorRender=P._render,priorDetail=P._detailHtml;
 P._detailHtml=function(type,h,c,hist){
  if(type!=="gas"&&type!=="water")return priorDetail.call(this,type,h,c,hist);
  const v=eh171Read(this,h,c)[type],title=type==="gas"?"Gas":"Water";
  return `<section class="detail-panel"><div class="detail-top"><div class="detail-title">${ehIcon(type)} <strong>${title}</strong></div><button class="detail-close" type="button" data-eh-close="1">×</button></div><div class="detail-value">${ehEsc(v.primary)}</div><div class="detail-stats"><div>Vandaag<strong>${ehEsc(v.today)}</strong></div><div>Meterstand<strong>${ehEsc(v.meter)}</strong></div>${type==="water"?`<div>Debiet<strong>${ehEsc(v.flow)}</strong></div>`:""}</div><p class="detail-muted">${ehEsc(v.info)}. ${ehEsc(v.note)}</p><div class="detail-source">Bron: ${ehEsc(v.source||v.totalId||"niet gekoppeld")}</div></section>`;
 };
 P._moreHtml=function(h,c){
  const v=eh171Read(this,h,c);
  const section=type=>{
   const x=v[type],gas=type==="gas";
   return `<section class="utility-card ${gas?"gas-card":"water-card"}"><div class="utility-head"><div class="sub-icon ${gas?"peach":"blue"}">${ehIcon(type)}</div><div><small>${gas?"Gas":"Water"} vandaag</small><strong>${ehEsc(x.today)}</strong></div></div><div class="subrows"><div><span>Vandaag</span><strong>${ehEsc(x.today)}</strong></div><div><span>Meterstand</span><strong>${ehEsc(x.meter)}</strong></div>${gas?"":`<div><span>Waterdebiet</span><strong>${ehEsc(x.flow)}</strong></div>`}<div><span>Dagbron</span><strong>${ehEsc(x.source||"Niet beschikbaar")}</strong></div></div><p class="subtle">${ehEsc(x.info)}. ${ehEsc(x.note)}</p></section>`;
  };
  return `<main class="subpage"><div class="subpage-head"><div><div class="eyebrow">HomeWizard · v1.7.1</div><h2>Gas &amp; water</h2><p>Meterstanden, dagverbruik en waterdebiet met betrouwbare bronvermelding.</p></div></div><div class="utility-grid">${section("gas")}${section("water")}</div><section class="subsection"><div class="section-title">${ehIcon("info")} Bronnen</div><div class="subrows"><div><span>Gasmeter</span><strong>${ehEsc(v.gas.totalId||"Niet gekoppeld")}</strong></div><div><span>Gas vandaag</span><strong>${ehEsc(v.gas.todayId||"Niet gekoppeld")}</strong></div><div><span>Watermeter</span><strong>${ehEsc(v.water.totalId||"Niet herkend")}</strong></div><div><span>Water vandaag</span><strong>${ehEsc(v.water.todayId||v.water.source||"Niet beschikbaar")}</strong></div><div><span>Waterdebiet</span><strong>${ehEsc(v.water.flowId||"Niet herkend")}</strong></div></div><p class="subtle">Automatische waterherkenning kiest alleen een eenduidige bron met herkenbare eenheid. Bij ontbrekende bron of historie toont Energiehuis geen verzonnen dagverbruik. Handmatig instellen blijft mogelijk.</p></section>${eh17MoreHtml(this,h,c)}</main>`;
 };
 P._eh171LoadDaily=async function(){
  const h=this._hass,c=this.config;
  if(!this.isConnected||!c||!h?.callWS)return;
  const sources=eh171Sources(h,c);
  const needed=["gas","water"].filter(type=>{const sensor=h.states?.[sources[type].today];return !sensor||eh171M3(sensor.state,sensor.attributes?.unit_of_measurement)===null;});
  const ids=needed.map(type=>sources[type].total).filter(id=>id&&h.states?.[id]);
  if(!ids.length)return;
  const mid=new Date();mid.setHours(0,0,0,0);
  const key=ehDayKey(mid)+"|"+ids.join("|");
  this._eh171DailyKey=key;
  if(this._eh171DailyLoading===key||this._eh171Daily?.key===key&&Date.now()-this._eh171Daily.at<300000)return;
  this._eh171DailyLoading=key;
  try{
   const first=new Date(mid.getTime()-36*3600000);
   const data=await h.callWS({type:"history/history_during_period",start_time:first.toISOString(),end_time:new Date().toISOString(),entity_ids:[...new Set(ids)],minimal_response:false,no_attributes:false,significant_changes_only:false});
   const values={};
   for(const type of needed)if(sources[type].total&&h.states[sources[type].total])values[type]=eh171DailyDelta(data,sources[type].total,h,mid.getTime());
   if(this._eh171DailyKey===key)this._eh171Daily={key,at:Date.now(),values};
  }catch(_){
   if(this._eh171DailyKey===key)this._eh171Daily={key,at:Date.now(),values:{},error:"Recorder kon geen beginstand aanleveren"};
  }finally{if(this._eh171DailyLoading===key)this._eh171DailyLoading=null;this._schedule();}
 };
 P._render=function(){
  priorRender.call(this);
  const c=this.config,h=this._hass;
  if(!c||!h)return;
  if(this._view==="overview"){
   const v=eh171Read(this,h,c);
   for(const type of ["gas","water"]){
    const tile=this.shadowRoot?.querySelector(".metric-"+type);
    if(!tile)continue;
    const value=tile.querySelector(".metric-value"),sub=tile.querySelector(".metric-sub");
    if(value)value.textContent=v[type].primary;
    if(sub)sub.textContent=v[type].subtitle;
   }
  }
  if(this._view==="overview"||this._view==="more")this._eh171LoadDaily();
 };
}

eh171Install();


