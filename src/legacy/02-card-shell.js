class EnergiehuisCard extends HTMLElement {
 constructor(){
  super();this.attachShadow({mode:'open'});
  this._history=null;this._historyAt=0;this._historyKey='';this._historyLoading=false;this._historyError=false;
  this._refreshTimer=null;this._queued=false;this._detail=null;this._selectedAt=null;this._dragging=false;this._priceSelected=0;this._cupraPriceSelected=null;this._metricPeriod='today';this._metricResult=null;this._metricCache=new Map();this._metricLoadingKey=null;this._metricRequestId=0;this._metricSelectedTime=null;this._metricDragging=false;this._cupraDetails=false;this._costComparePeriod='month';this._costCompareResult=null;this._costCompareLoading=false;this._costCompareAt=0;this._costCompareKey='';this._costCompareSelectedTime=null;this._costCompareDragging=false;this._cupraInsightsPeriod='month';this._cupraInsightsResult=null;this._cupraInsightsCache=new Map();this._cupraInsightsLoadingKey=null;this._cupraAllHistoryCache=null;this._cupraAllHistoryPending=null;
   this._view='overview';this._chargeMode='slim';this._targetSoc=80;this._departure=ehDefaultDeparture();this._simNeed=null;this._simPower=null;
  this.shadowRoot.addEventListener('click',e=>{
    const page=e.target.closest('[data-eh-page]');
   if(page){
     const next=page.dataset.ehPage;
     if(['overview','cupra','charge','battery','costs','more'].includes(next)){
       this._view=next;this._detail=null;
       this._schedule();
       if(next==='costs'){this._ehcmpInit();this._ehcmpLoad();}
       if(next==='cupra')this._loadCupraInsights();
       requestAnimationFrame(()=>{if(this.isConnected)this.scrollIntoView({behavior:'smooth',block:'start'});});
       // De pagina blijft binnen dezelfde Lovelace kaart: geen route of backend wijziging.
     }
     return;
   }
   const insightPeriod=e.target.closest('[data-eh-cupra-insight-period]');
   if(insightPeriod){
     const p=insightPeriod.dataset.ehCupraInsightPeriod;
     if(EH_CUPRA_PERIODS.some(x=>x[0]===p)){this._cupraInsightsPeriod=p;this._cupraInsightsResult=null;this._schedule();this._loadCupraInsights();}
     return;
   }
   const costPeriod=e.target.closest('[data-eh-cost-period]');
   if(costPeriod){
     const p=costPeriod.dataset.ehCostPeriod;
     if(['month','year'].includes(p)){this._costComparePeriod=p;this._costCompareSelectedTime=null;this._costCompareResult=null;this._schedule();this._loadCostCompare();}
     return;
   }
   const details=e.target.closest('[data-eh-cupra-details]');
   if(details){this._cupraDetails=!this._cupraDetails;this._schedule();return;}
   const powerChoice=e.target.closest('[data-eh23-power]');
   if(powerChoice){
     if(powerChoice.disabled)return;
     const current=eh24ChargeReading(this._hass,this.config.laden,{maxAgeMs:2*60*1000}).watts;
     const suggestion=powerChoice.dataset.eh23Power==='current'?(current!==null&&current>=1400?current/1000:null):
       powerChoice.dataset.eh23Power==='history'?eh23ChargePowerSuggestion(this._eh17Sessions?.error?[]:this._eh17Sessions?.sessions)?.kw:null;
     if(Number.isFinite(suggestion)&&suggestion>=1.4){this._simPower=Math.min(7.4,Number(suggestion.toFixed(2)));this._eh24PowerChoice=powerChoice.dataset.eh23Power;this._schedule();}
     return;
   }
   const mode=e.target.closest('[data-eh-mode]');
   if(mode){
     if(['slim','direct','sun','pause'].includes(mode.dataset.ehMode)){
       this._chargeMode=mode.dataset.ehMode;this._schedule();
     }
     return;
   }
   const metric=e.target.closest('[data-eh-detail]');
    if(metric){
      const id=metric.dataset.ehDetail;
      this._detail=this._detail===id?null:id;
      this._metricSelectedTime=null;this._schedule();this._loadMetricData();return;
    }
    const period=e.target.closest('[data-eh-period]');
    if(period){
      const id=period.dataset.ehPeriod;
      if(EH_PERIODS.some(p=>p[0]===id)){this._metricPeriod=id;this._metricSelectedTime=null;this._metricResult=null;this._schedule();this._loadMetricData();}
      return;
    }
    const close=e.target.closest('[data-eh-close]');
    if(close){this._detail=null;this._schedule();return;}
    const cp=e.target.closest('[data-eh-cupra-price]');
    if(cp){this._cupraPriceSelected=Number(cp.dataset.ehCupraPrice);this._schedule();return;}
    const price=e.target.closest('[data-eh-price]');
    if(price){this._priceSelected=Number(price.dataset.ehPrice);this._schedule();return;}
    const a=e.target.closest('[data-eh-path]');
    if(!a||!this._hass)return;
    const path=a.getAttribute('data-eh-path');
    if(path&&path.startsWith('/')&&!path.startsWith('//')){
      history.pushState(null,'',path);window.dispatchEvent(new Event('location-changed'));
    }
  });
  this.shadowRoot.addEventListener('input',e=>{
    if(e.target.matches('[data-eh-time-range]'))this._updateSelection(Number(e.target.value));
  });
   this.shadowRoot.addEventListener('change',e=>{
     const t=e.target;
     if(t.matches('[data-eh-cupra-range]')){
       const nodes=[...this.shadowRoot.querySelectorAll('[data-eh-cupra-price]')];
       const btn=nodes[Math.max(0,Math.min(nodes.length-1,Number(t.value)))];
       if(btn){this._cupraPriceSelected=Number(btn.dataset.ehCupraPrice);this._schedule();}
       return;
     }
     if(t.matches('[data-eh-target]')){
       const n=Number(t.value);if(Number.isFinite(n))this._targetSoc=Math.max(50,Math.min(100,n));
       this._schedule();
     }
     if(t.matches('[data-eh-departure]')){
       this._departure=t.value;this._schedule();
     }
     if(t.matches('[data-eh-kwh]')){
       const n=Number(t.value.replace(',','.'));
       if(Number.isFinite(n)&&n>0&&n<=100)this._simNeed=n;
       this._schedule();
     }
     if(t.matches('[data-eh-kw]')){
       const n=Number(t.value.replace(',','.'));
       if(Number.isFinite(n)&&n>=1.4&&n<=7.4){this._simPower=n;this._eh24PowerChoice=null;}
       this._schedule();
     }
   });
  this.shadowRoot.addEventListener('pointerdown',e=>{
    const cost=e.target.closest('[data-eh-cost-plot]');
    if(cost){this._costCompareDragging=true;this._selectCostCompareFromPointer(cost,e);return;}
    const metric=e.target.closest('[data-eh-metric-plot]');
    if(metric){this._metricDragging=true;this._selectMetricFromPointer(metric,e);return;}
    const svg=e.target.closest('[data-eh-history-chart]');
    if(!svg)return;
    this._dragging=true;
    try{svg.setPointerCapture(e.pointerId)}catch(_){}
    this._selectFromPointer(svg,e);
  });
  this.shadowRoot.addEventListener('pointermove',e=>{
    const cost=e.target.closest('[data-eh-cost-plot]');
    if(cost && (this._costCompareDragging||e.pointerType==='mouse')){this._selectCostCompareFromPointer(cost,e);return;}
    const metric=e.target.closest('[data-eh-metric-plot]');
    if(metric && (this._metricDragging||e.pointerType==='mouse')){this._selectMetricFromPointer(metric,e);return;}
    const svg=e.target.closest('[data-eh-history-chart]');
    if(svg && (this._dragging || e.pointerType==='mouse'))this._selectFromPointer(svg,e);
  });
  this.shadowRoot.addEventListener('pointerup',()=>{this._dragging=false;this._metricDragging=false;this._costCompareDragging=false});
  this.shadowRoot.addEventListener('pointercancel',()=>{this._dragging=false;this._metricDragging=false;this._costCompareDragging=false});
 }
 _selectFromPointer(svg,e){
  const hist=this._history;
  if(!hist?.samples?.length)return;
  const r=svg.getBoundingClientRect();
  const left=Number(svg.dataset.ehLeft),right=Number(svg.dataset.ehRight),w=Number(svg.dataset.ehWidth);
  const x=(e.clientX-r.left)/r.width*w;
  const fraction=Math.max(0,Math.min(1,(x-left)/(right-left)));
  const target=hist.start+fraction*(hist.dayEnd-hist.start);
  this._updateSelection(ehClosestIndex(hist.samples,target));
 }
 _updateSelection(index){
  const hist=this._history;if(!hist?.samples?.length)return;
  const ix=Math.max(0,Math.min(hist.samples.length-1,Math.round(index)));
  const sample=hist.samples[ix];this._selectedAt=sample.t;
  const root=this.shadowRoot,svg=root.querySelector('[data-eh-history-chart]');
  const slider=root.querySelector('[data-eh-time-range]');if(slider)slider.value=String(ix);
  const clock=root.querySelector('[data-eh-clock]');if(clock)clock.textContent=ehClock(sample.t);
  const ids=[this.config.zonnepanelen,this.config.huis,this.config.net,this.config.laden];
  ['Zon','Huis','Net','Auto'].forEach((name,i)=>{
    const el=root.querySelector(`[data-eh-reading="${name}"]`);
    if(el)el.textContent=Number.isFinite(sample[ids[i]])?ehPower(sample[ids[i]]):'—';
  });
  if(svg){
    const left=Number(svg.dataset.ehLeft),right=Number(svg.dataset.ehRight);
    const x=left+(sample.t-hist.start)/(hist.dayEnd-hist.start)*(right-left);
    const cursor=svg.querySelector('[data-eh-cursor]');
    if(cursor){cursor.setAttribute('x1',x.toFixed(1));cursor.setAttribute('x2',x.toFixed(1))}
    const min=Number(svg.dataset.ehMin),max=Number(svg.dataset.ehMax),top=Number(svg.dataset.ehTop),height=Number(svg.dataset.ehHeight);
    ids.forEach((id,i)=>{
      const dot=svg.querySelector(`[data-eh-dot="${i}"]`);if(!dot)return;
      const v=sample[id];dot.setAttribute('visibility',Number.isFinite(v)?'visible':'hidden');
      if(Number.isFinite(v)){dot.setAttribute('cx',x.toFixed(1));dot.setAttribute('cy',(top+(max-v)/(max-min)*height).toFixed(1));}
    });
  }
 }
 _detailHtml(type,h,c,hist){
  if(['grid','sun','home','car'].includes(type))return this._energyDetailHtml(type,h,c,hist);
  if(type==='gas'||type==='water'){
    const isGas=type==='gas';
    const dayId=isGas?c.gas_today:c.water_today;
    const mainId=isGas?c.gas:c.water;
    const flowId=isGas?'':c.water_flow;
    const day=ehMeasure(h,dayId,2),main=ehMeasure(h,mainId,2),flow=ehMeasure(h,flowId,2);
    const primary=day.n!==null?day:(flow.n!==null?flow:main);
    const title=isGas?'Gas':'Water';
    const note=isGas?'Gasverbruik uit Home Assistant.':'Waterverbruik uit Home Assistant.';
    return `<section class="detail-panel" aria-label="Details ${title}"><div class="detail-top"><div class="detail-title">${ehIcon(type)} <strong>${title}</strong></div><button type="button" class="detail-close" data-eh-close="1" aria-label="Sluit details">×</button></div><div class="detail-value">${ehEsc(primary.text)}</div><p class="detail-muted">${note}</p><div class="detail-stats"><div>Vandaag<strong>${ehEsc(day.text)}</strong></div><div>${isGas?'Meterstand':'Live debiet'}<strong>${ehEsc(isGas?main.text:flow.text)}</strong></div></div><p class="detail-muted">${dayId?'Dagtotaal gekoppeld.':'Koppel de optionele '+(isGas?'gas_today':'water_today')+' entiteit om het dagverbruik direct op Home te tonen.'}</p><div class="detail-source">Bron: ${ehEsc(dayId||flowId||mainId||'niet gekoppeld')}</div></section>`;
  }
  const info={
    grid:['Netvermogen','grid',c.net,'Netafname positief, teruglevering negatief.'],
    sun:['Zonnepanelen','sun',c.zonnepanelen,'Actueel vermogen van de GoodWe-omvormer.'],
    home:['Huisverbruik exclusief Cupra','home',c.huis,'Berekening: P1 + zonnepanelen − Alfen.'],
    euro:['Stroomprijs','euro',c.prijs,'Dynamisch tarief volgens de Zonneplan-sensor.'],
    car:['Cupra Born','car',c.laden,'Laadvermogen komt van Alfen. Accustand alleen als Cupra-sensor is gekoppeld.'],
    battery:['Virtuele batterij','battery',c.batterij,'Een virtuele batterij is een administratieve berekening, geen fysieke opslag.']
  }[type];
  if(!info)return '';
  const [title,icon,id,note]=info;
  const unit=type==='euro'?'€/kWh':type==='battery'?'%':'W';
  const live=type==='euro'?ehCurrentPrice(h,id):type==='battery'?ehRead(h,id):ehW(h,id);
  const formatted=type==='euro'?ehMoney(live):type==='battery'?(live===null?'—':ehFmt(live,0)+'%'):ehPower(live);
  const hasHistory=['grid','sun','home','car'].includes(type);
  const selectedId=type==='car'?c.laden:id;
  const vals=hasHistory&&hist?.samples?.length?hist.samples.map(p=>p[selectedId]).filter(Number.isFinite):[];
  const minimum=vals.length?Math.min(...vals):null,maximum=vals.length?Math.max(...vals):null;
  const forecast=type==='euro'?ehForecast(h,c.prijs):[];
  const item=Math.max(0,Math.min(forecast.length-1,this._priceSelected));
  const sorted=forecast.map((o,i)=>({...o,i})).sort((a,b)=>a.p-b.p);
  const priceMax=forecast.length?Math.max(0.1,...forecast.map(p=>p.p)):1;
  const extra=type==='euro' ? (forecast.length?
    `<div class="detail-small-title">Aankomende uurprijzen · tik op een uur</div>
     <div class="price-bars">${forecast.slice(0,24).map((v,i)=>{
       const hh=v.t?ehClock(Date.parse(v.t)):String(i).padStart(2,'0')+':00';
       const cheapest=sorted.slice(0,Math.min(4,sorted.length)).some(x=>x.i===i);
       return `<button type="button" class="price-hour ${i===item?'chosen':''} ${cheapest?'cheap':''}" data-eh-price="${i}" aria-label="${ehEsc(hh)}: ${ehEsc(ehMoney(v.p))} per kilowattuur"><span style="height:${Math.max(9,Math.min(100,Math.abs(v.p)/priceMax*100))}%"></span></button>`;
     }).join('')}</div><div class="price-inspect"><strong>${ehEsc(forecast[item].t?ehClock(Date.parse(forecast[item].t)):'Uur '+(item+1))}</strong><strong>${ehEsc(ehMoney(forecast[item].p))}/kWh</strong></div>`
    :'<p class="detail-muted">Geen uurforecast beschikbaar in de Zonneplan-sensor.</p>'):
    hasHistory?`<div class="detail-stats"><div>Laagste vandaag<strong>${ehEsc(ehPower(minimum))}</strong></div><div>Hoogste vandaag<strong>${ehEsc(ehPower(maximum))}</strong></div></div><p class="detail-muted">Tik op de grafiek hieronder om de historische waarden per tijdstip te bekijken.</p>`:
    `<p class="detail-muted">${type==='battery'&&!c.batterij?'Nog geen virtuele-batterijsensor gekoppeld.':'Meer functies volgen nadat de benodigde sensoren zijn aangesloten.'}</p>`;
  const carExtra=type==='car'?`<p class="detail-muted">Accustand Cupra: ${c.cupra&&ehRead(h,c.cupra)!==null?ehEsc(ehFmt(ehRead(h,c.cupra),0)+'%'):'niet gekoppeld'} · Alfen stroom L1: ${ehRead(h,c.stroom)===null?'—':ehEsc(ehFmt(ehRead(h,c.stroom),1)+' A')}</p>`:'';
  return `<section class="detail-panel" aria-label="Details ${ehEsc(title)}"><div class="detail-top"><div class="detail-title">${ehIcon(icon)} <strong>${ehEsc(title)}</strong></div><button type="button" class="detail-close" data-eh-close="1" aria-label="Sluit details">×</button></div><div class="detail-value">${ehEsc(formatted)}</div><p class="detail-muted">${ehEsc(note)}</p>${carExtra}${extra}<div class="detail-source">Bron: ${ehEsc(id||'niet gekoppeld')}</div></section>`;
 }
 _selectMetricFromPointer(svg,event){
  const result=this._metricResult,period=this._metricPeriod;
  if(!result || this._detail===null)return;
  const values=(period==='today'||period==='yesterday')&&result.raw?.length?result.raw:result.buckets;
  if(!values?.length)return;
  const r=svg.getBoundingClientRect(),left=Number(svg.dataset.ehLeft),right=Number(svg.dataset.ehRight),w=Number(svg.dataset.ehWidth);
  if(!r.width)return;
  const fx=Math.max(0,Math.min(1,((event.clientX-r.left)/r.width*w-left)/(right-left)));
  const target=result.limits.from.getTime()+fx*(result.limits.to.getTime()-result.limits.from.getTime());
  const nearest=values.reduce((a,b)=>Math.abs(b.t-target)<Math.abs(a.t-target)?b:a,values[0]);
  if(nearest&&this._metricSelectedTime!==nearest.t){this._metricSelectedTime=nearest.t;this._schedule();}
 }
 _selectCostCompareFromPointer(svg,event){
  const result=this._costCompareResult;
  if(!result?.points?.length)return;
  const r=svg.getBoundingClientRect(),left=Number(svg.dataset.ehLeft),right=Number(svg.dataset.ehRight),w=Number(svg.dataset.ehWidth);
  if(!r.width)return;
  const fx=Math.max(0,Math.min(1,((event.clientX-r.left)/r.width*w-left)/(right-left)));
  const target=result.from.getTime()+fx*(result.to.getTime()-result.from.getTime());
  const nearest=result.points.reduce((a,b)=>Math.abs(b.t-target)<Math.abs(a.t-target)?b:a,result.points[0]);
  if(nearest&&this._costCompareSelectedTime!==nearest.t){this._costCompareSelectedTime=nearest.t;this._schedule();}
 }
 async _loadCostCompare(){
  const h=this._hass,c=this.config,p=this._costComparePeriod;
  if(this._view!=='costs'||!h?.callWS||!c)return;
  const now=new Date();
  const from=p==='month'?new Date(now.getFullYear(),now.getMonth(),1):new Date(now.getFullYear(),0,1);
  const step=p==='month'?'day':'month';
  const ids=p==='month'?[c.cost_zonneplan_month,c.cost_vattenfall_1_month,c.cost_vattenfall_3_month]:[c.cost_zonneplan_year,c.cost_vattenfall_1_year,c.cost_vattenfall_3_year];
  if(ids.some(id=>!id)){this._costCompareResult={period:p,from,to:now,points:[],historyCount:0,error:'Niet alle kostensensoren zijn gekoppeld.',fetched:Date.now()};this._schedule();return;}
  const key=p+'|'+ehDayKey(from)+'|'+ids.join('|');
  if(this._costCompareKey===key&&Date.now()-this._costCompareAt<5*60*1000&&this._costCompareResult){this._schedule();return;}
  if(this._costCompareLoading)return;
  this._costCompareLoading=true;this._costCompareResult=null;this._schedule();
  try{
   const bins=ehWindows({from,to:now,step});
   const before=p==='month'?new Date(from.getFullYear(),from.getMonth(),from.getDate()-1):new Date(from.getFullYear()-1,11,1);
   const stats=await h.callWS({type:'recorder/statistics_during_period',start_time:before.toISOString(),end_time:now.toISOString(),statistic_ids:[...new Set(ids)],period:step,types:['change','sum']});
   const live={z:ehRead(h,ids[0]),v1:ehRead(h,ids[1]),v3:ehRead(h,ids[2])};
   const built=ehCostComparePoints(stats,ids,bins,step,h,live,now);
   this._costCompareResult={period:p,from,to:now,points:built.points,historyCount:built.historyCount,error:null,fetched:Date.now()};
   this._costCompareKey=key;this._costCompareAt=Date.now();
  }catch(_){
   this._costCompareResult={period:p,from,to:now,points:[],historyCount:0,error:'Langetermijnstatistieken voor de kostensensoren zijn niet beschikbaar.',fetched:Date.now()};
   this._costCompareKey=key;this._costCompareAt=Date.now();
  }finally{this._costCompareLoading=false;this._schedule();}
 }
 async _loadMetricData(){
  const type=this._detail,p=this._metricPeriod,c=this.config,h=this._hass;
  if(!['grid','sun','home','car'].includes(type)||!h?.callWS||!c)return;
  const lim=ehPeriodLimits(p),bins=ehWindows(lim),id=({grid:c.net,sun:c.zonnepanelen,home:c.huis,car:c.laden})[type];
  const key=p+'|'+type+'|'+ehDayKey(lim.from)+'|'+[c.import,c.export,c.zonne_energie,c.laad_energie,c.huis_energie,c.huis,c.net,c.laden,c.zonnepanelen].join('|');
  const now=Date.now(),ttl=p==='today'?5*60*1000:30*60*1000;
  const cached=this._metricCache.get(key);
  if(cached&&now-cached.fetched<ttl){this._metricResult=cached;this._schedule();return;}
  if(this._metricLoadingKey===key)return;
  this._metricLoadingKey=key;const request=++this._metricRequestId;
  this._metricResult=null;this._schedule();
  try{
    const statisticIds=[c.import,c.export,c.zonne_energie,c.laad_energie,c.huis_energie,c.huis].filter(Boolean);
    // Extra tijdvak vóór begin voor oude HA-installaties die alleen een cumulatieve 'sum' leveren.
    const before=p==='today'||p==='yesterday'?new Date(lim.from.getTime()-3600000):lim.step==='month'?new Date(lim.from.getFullYear(),lim.from.getMonth()-1,1):new Date(lim.from.getFullYear(),lim.from.getMonth(),lim.from.getDate()-1);
    const stats=await h.callWS({type:'recorder/statistics_during_period',start_time:before.toISOString(),end_time:lim.to.toISOString(),statistic_ids:[...new Set(statisticIds)],period:lim.step,types:['change','sum','mean'],units:{energy:'kWh'}});
    const buckets=ehEnergyBuckets(stats,bins,lim.step,c,h);
    let raw=[];
    if(p==='today'&&this._history?.samples?.length){
      raw=this._history.samples.map(o=>({t:o.t,v:o[id]})).filter(o=>Number.isFinite(o.v));
    }else if(p==='yesterday'&&id){
      try{
        const data=await h.callWS({type:'history/history_during_period',start_time:lim.from.toISOString(),end_time:lim.to.toISOString(),entity_ids:[id],minimal_response:true,no_attributes:false,significant_changes_only:false});
        raw=ehDailyHistoryPoints(data,id,h,lim.from.getTime(),lim.to.getTime());
      }catch(_){/* Recorder-statistieken blijven bruikbaar. */}
    }
    let comparison=null;
    if(p==='year'){
      const date=lim.to,year=date.getFullYear()-1;
      const priorStart=new Date(year,0,1),priorEnd=new Date(year,date.getMonth(),Math.min(date.getDate(),new Date(year,date.getMonth()+1,0).getDate()),date.getHours(),date.getMinutes());
      if(priorEnd>priorStart){
        try{
          const b=ehWindows({from:priorStart,to:priorEnd,step:'day'});
          const stat=await h.callWS({type:'recorder/statistics_during_period',start_time:new Date(year-1,11,31).toISOString(),end_time:priorEnd.toISOString(),statistic_ids:[...new Set(statisticIds)],period:'day',types:['change','sum','mean'],units:{energy:'kWh'}});
          comparison=ehEnergyBuckets(stat,b,'day',c,h);
        }catch(_){comparison=null;}
      }
    }
    const result={key,type,period:p,limits:lim,buckets,raw,comparison,error:null,fetched:Date.now()};
    this._metricCache.set(key,result);
    // Houd cache klein: hooguit 18 combinatievragen; geen lokale opslag of serverzijde wijzigingen.
    if(this._metricCache.size>18)this._metricCache.delete(this._metricCache.keys().next().value);
    if(request===this._metricRequestId&&this._detail===type&&this._metricPeriod===p){this._metricResult=result;this._schedule();}
  }catch(error){
    if(request===this._metricRequestId&&this._detail===type&&this._metricPeriod===p){
      this._metricResult={key,type,period:p,limits:lim,buckets:[],raw:[],error:'Recorder-statistieken niet beschikbaar. Controleer of deze sensoren langetermijnstatistieken leveren.',fetched:Date.now()};
      this._schedule();
    }
  }finally{if(this._metricLoadingKey===key)this._metricLoadingKey=null;}
 }
 _energyDetailHtml(type,h,c,hist){
   const info=ehSeriesInfo(type),period=this._metricPeriod,result=this._metricResult;
   const actual=result?.period===period&&result?.type===type?result:null;
   const p=EH_PERIODS.find(x=>x[0]===period)?.[1]||'Vandaag';
   const bins=actual?.buckets||[],parts=info.parts;
   const sum=(list,key)=>{
     if(!list?.length)return null;
     const values=list.map(b=>b[key]).filter(Number.isFinite);
     return values.length&&values.length===list.length?values.reduce((a,b)=>a+b,0):null;
   };
   const total=(key)=>sum(bins,key);
   const summary=type==='grid'?`<div class="energy-totals"><div><small>Netafname</small><strong>${ehEnergy(total('import'))}</strong></div><div><small>Teruglevering</small><strong>${ehEnergy(total('export'))}</strong></div></div>`:
     `<div class="energy-totals"><div><small>${type==='home'?'Woning excl. auto':type==='sun'?'Totaal opgewekt':'Totaal geladen'}</small><strong>${ehEnergy(total(parts[0][1]))}</strong></div></div>`;
   const old=actual?.comparison,oldTotal=old&&sum(old,type==='grid'?'import':parts[0][1]);
   const currentTotal=total(type==='grid'?'import':parts[0][1]);
   const diff=period==='year'&&Number.isFinite(oldTotal)&&oldTotal>0&&Number.isFinite(currentTotal)?(currentTotal-oldTotal)/oldTotal*100:null;
   const compare=period==='year'?`<div class="energy-compare"><span>${type==='grid'?'Netafname · ':''}Zelfde periode vorig jaar</span><strong>${ehEnergy(oldTotal)}</strong><span>${diff===null?'Vergelijking niet beschikbaar':`${diff>0?'+':''}${ehFmt(diff,1)}% ${diff>0?'meer':diff<0?'minder':'gelijk'}`}</span></div>`:'';
   const raw=period==='today'&&hist?.samples?.length?hist.samples.map(o=>({t:o.t,v:o[({grid:c.net,sun:c.zonnepanelen,home:c.huis,car:c.laden})[type]]})).filter(o=>Number.isFinite(o.v)):(actual?.raw||[]);
   const values=(period==='today'||period==='yesterday')&&raw.length?raw:bins.filter(b=>parts.some(a=>Number.isFinite(b[a[1]])));
   const picked=values.length?values.reduce((a,b)=>this._metricSelectedTime===null||this._metricSelectedTime===undefined?(b.t>a.t?b:a):(Math.abs(b.t-this._metricSelectedTime)<Math.abs(a.t-this._metricSelectedTime)?b:a),values[0]):null;
   const reading= picked? ((period==='today'||period==='yesterday')&&raw.length
     ?`${ehClock(picked.t)} · ${ehPower(picked.v)}`
     :`${period==='year'||period==='prevyear'?new Date(picked.t).toLocaleDateString('nl-NL',{month:'long',year:'numeric'}):ehDateText(picked.t)} · ${parts.map(a=>`${a[0]}: ${ehEnergy(picked[a[1]])}`).join(' · ')}`):'Tik op de grafiek om een tijdstip te bekijken';
   const estimated=bins.some(b=>b.estimated)&&type==='home';
   const soc=type==='car'?ehRead(h,c.cupra):null;
   const sourceInfo=type==='home'?'Huisverbruik wordt berekend uit netafname − teruglevering + zonopwek − autoladen, of uit een eigen huis-kWh-sensor.':type==='grid'?'Positief netvermogen is afname; teruglevering tonen we apart.':'De grafiek gebruikt je gekoppelde Home Assistant-entiteiten.';
   return `<section class="detail-panel energy-detail" aria-label="${ehEsc(info.title)} historisch overzicht"><div class="detail-top"><div class="detail-title">${ehIcon(info.icon)} <strong>${ehEsc(info.title)}</strong></div><button type="button" class="detail-close" data-eh-close="1" aria-label="Sluit details">×</button></div>
      <p class="detail-muted">${ehEsc(info.note)}</p><div class="energy-periods">${EH_PERIODS.map(([id,label])=>`<button type="button" data-eh-period="${id}" class="energy-period ${period===id?'chosen':''}" aria-pressed="${period===id}">${label}</button>`).join('')}</div>
      <div class="energy-period-label">${ehEsc(p)} · ${ehEsc(ehDateText(ehPeriodLimits(period).from))}${period==='today'?'':` — ${ehEsc(ehDateText(new Date(ehPeriodLimits(period).to.getTime()-1)))}`}</div>
      ${summary}${type==='car'?`<p class="detail-muted">Cupra-accustand: ${soc===null?'Niet gekoppeld':ehEsc(ehFmt(soc,0)+'%')} · Laadvermogen komt van Alfen.</p>`:''}${compare}
      ${actual?.error?`<p class="plan-warning">${ehEsc(actual.error)}</p>`:''}
      ${!actual?'<div class="energy-loading">Langetermijnstatistieken ophalen…</div>':ehMetricChart(type,period,bins,raw,picked?.t??0,actual.limits)}
      <div class="energy-point-readout" aria-live="polite">${ehEsc(reading)}</div><p class="detail-muted">Tik op de grafiek om een meetmoment, dag of maand te selecteren.</p>
      <div class="energy-legend">${parts.map(([name,key,color])=>`<span><i style="background:${color}"></i>${ehEsc(name)}</span>`).join('')}</div>
      ${estimated?'<p class="detail-muted">Een deel van het woningverbruik is geschat op basis van gemiddeld vermogen; deze totalen kunnen afwijken.</p>':''}
      <p class="detail-muted">${ehEsc(sourceInfo)} Ontbrekende meetperioden worden niet opgevuld met fictieve waarden.</p>
     </section>`;
 }
 setConfig(config){
  if(!config || typeof config!=='object')throw new Error('Ongeldige Energiehuis-configuratie');
  this.config={...EH_DEFAULTS,...config};this._historyAt=0;this._metricCache.clear();this._metricResult=null;this._costCompareResult=null;this._costCompareKey='';this._costCompareAt=0;this._cupraInsightsResult=null;this._cupraInsightsCache.clear();this._cupraInsightsLoadingKey=null;this._cupraAllHistoryCache=null;this._cupraAllHistoryPending=null;this._schedule();this._loadMetricData();this._loadCostCompare();this._loadCupraInsights();
 }
 set hass(hass){this._hass=hass;this._schedule();this._loadHistory();this._loadMetricData();this._loadCostCompare();this._loadCupraInsights();}
 getCardSize(){return 9}
 static getStubConfig(){return {type:'custom:energiehuis-card'}}
 connectedCallback(){
  this._loadHistory();this._loadMetricData();this._loadCostCompare();this._loadCupraInsights();
  if(!this._refreshTimer)this._refreshTimer=setInterval(()=>{this._loadHistory();this._loadCostCompare();this._loadCupraInsights();},5*60*1000);
  if(!this._eh19NetworkListener && typeof window.addEventListener==='function'){
   this._eh19NetworkListener=()=>this._schedule();
   window.addEventListener('online',this._eh19NetworkListener);
   window.addEventListener('offline',this._eh19NetworkListener);
  }
 }
 disconnectedCallback(){
  // Native custom-element lifecycle: post-define prototype overrides are ignored.
  if(this._eh26DocumentHandlers){
   const {pointer,focus,key}=this._eh26DocumentHandlers;
   this._eh26DocumentHandlers=null;
   document.removeEventListener('pointerdown',pointer,true);
   document.removeEventListener('focusin',focus,true);
   document.removeEventListener('keydown',key,true);
  }
  this._eh26MenuOpen=false;
  this._eh26RestoreFocus=null;
  // v1.27 Live Cockpit: timers, animatie, observers en een lopende beeldaanvraag stoppen.
  if(typeof this._ehLiveSuspend==='function')this._ehLiveSuspend();
  if(this._refreshTimer){clearInterval(this._refreshTimer);this._refreshTimer=null;}
  if(this._eh19Observer){this._eh19Observer.disconnect();this._eh19Observer=null;}
  if(this._eh19NetworkListener){
   window.removeEventListener?.('online',this._eh19NetworkListener);
   window.removeEventListener?.('offline',this._eh19NetworkListener);
   this._eh19NetworkListener=null;
  }
 }
 _schedule(){
  if(this._queued)return;
  this._queued=true;
  requestAnimationFrame(()=>{this._queued=false;if(this.isConnected)this._render()});
 }
 async _loadHistory(){
  const h=this._hass,c=this.config;
  if(!this.isConnected||!h?.callWS||!c||this._historyLoading)return;
  const ids=[c.zonnepanelen,c.huis,c.net,c.laden].filter(Boolean);
  const now=new Date(),key=ehDayKey(now)+'|'+ids.join('|');
  if(this._historyKey===key && Date.now()-this._historyAt<5*60*1000)return;
  if(this._historyKey && !this._historyKey.startsWith(ehDayKey(now)+'|'))this._selectedAt=null;
  this._historyLoading=true;
  try {
    const data=await h.callWS({
      type:'history/history_during_period',
      start_time:ehMidnight(now).toISOString(),end_time:now.toISOString(),
      entity_ids:[...new Set(ids)],minimal_response:true,no_attributes:false,
      significant_changes_only:false
    });
    this._history=ehSamplesFromHistory(data,ids,h,now);
    this._historyError=false;this._historyKey=key;this._historyAt=Date.now();
  } catch(err){
    this._historyError=true;this._historyKey=key;this._historyAt=Date.now();
    // Fouten blijven beperkt tot de historiegrafiek; live-sensoren blijven bruikbaar.
  } finally {this._historyLoading=false;this._schedule();}
 }
 async _cupraAllHistory(h,c,now,ids,capacity,ttl){
  // De periodeknoppen filteren uitsluitend kilometerweergaven. Analyseer de
  // volledige beschikbare Recorder-detailhistorie, ook uit eerdere jaren.
  // Een Cupra Born kan geen relevante ritten voor 2020 hebben.
  const analysisFrom=new Date('2020-01-01T00:00:00.000Z');
  const key=ids.join('|')+'|'+capacity;
  const previous=this._cupraAllHistoryCache;
  if(previous?.key===key&&Date.now()-previous.fetched<ttl)return previous;
  if(this._cupraAllHistoryPending?.key===key)return this._cupraAllHistoryPending.promise;
  const promise=(async()=>{
   let history=null,historyWarning='';
   try{
    history=await h.callWS({type:'history/history_during_period',start_time:analysisFrom.toISOString(),end_time:now.toISOString(),entity_ids:[...new Set(ids)],minimal_response:true,no_attributes:false,significant_changes_only:false});
   }catch(_){historyWarning='Beschikbare detailhistorie voor de Cupra-analyse kon niet worden opgehaald.';}
   const seg=history?ehCupraSegments(history,c,h,analysisFrom,now,capacity):{segments:[],chargeSegments:[],anchors:0,homeChargeExcluded:0,externalChargeSuspected:0,noiseExcluded:0,coverageFrom:null,coverageTo:null};
   const temp=ehTempGroups(seg.segments,capacity),metrics=ehCupraInsightMetrics(seg,capacity);
   // Alleen voor de kilometerstatistiek-fallback: hergebruik de opgehaalde
   // kilometerhistorie; geen tweede grote Recorder-query.
   let fallbackDaily=[];
   if(history){
    const ms=ehNumericHistory(history,c.cupra_mileage,h),byDay=new Map();
    for(let i=1;i<ms.length;i++){
     const d=ms[i].v-ms[i-1].v;
     if(!Number.isFinite(d)||d<=0||d>400)continue;
     const date=new Date(ms[i].t),t=new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime();
     byDay.set(t,(byDay.get(t)||0)+d);
    }
    fallbackDaily=[...byDay.entries()].map(([t,km])=>({t,km})).sort((a,b)=>a.t-b.t);
   }
   return {key,fetched:Date.now(),seg,temp,metrics,fallbackDaily,historyWarning};
  })();
  this._cupraAllHistoryPending={key,promise};
  try{
   const result=await promise;
   if(this._cupraAllHistoryPending?.promise===promise)this._cupraAllHistoryCache=result;
   return result;
  }finally{
   if(this._cupraAllHistoryPending?.promise===promise)this._cupraAllHistoryPending=null;
  }
 }
 async _loadCupraInsights(){
  const h=this._hass,c=this.config,p=this._cupraInsightsPeriod;
  if(this._view!=='cupra'||!h?.callWS||!c)return;
  const now=new Date(),lim=ehCupraPeriodLimits(p,now),yearStart=new Date(now.getFullYear(),0,1);
  const ids=[c.cupra,c.cupra_mileage,c.cupra_range,c.cupra_outside_temp,c.cupra_target_temp,c.cupra_climate_usage,c.cupra_onboard_usage,c.laad_energie].filter(Boolean);
  const key=p+'|'+ehDayKey(lim.from)+'|'+ids.join('|');
  const ttl=Math.max(5,Number(c.cupra_refresh_minutes)||15)*60*1000;
  const cached=this._cupraInsightsCache.get(key);
  if(cached&&Date.now()-cached.fetched<ttl){this._cupraInsightsResult=cached;this._schedule();return;}
  if(this._cupraInsightsLoadingKey===key)return;
  this._cupraInsightsLoadingKey=key;this._cupraInsightsResult=null;this._schedule();
  let daily=[],statsWarning='',dailyCoverageFrom=yearStart.getTime();
  try{
   const before=new Date(yearStart.getFullYear()-1,11,31);
   const stats=await h.callWS({type:'recorder/statistics_during_period',start_time:before.toISOString(),end_time:now.toISOString(),statistic_ids:[c.cupra_mileage],period:'day',types:['change','min','max','mean']});
   daily=ehCupraKmDaily(stats,c.cupra_mileage);
   const covered=daily.filter(x=>x.t>=yearStart.getTime()&&x.t<=now.getTime()&&Number.isFinite(x.km));
   dailyCoverageFrom=covered.length?Math.max(yearStart.getTime(),covered[0].t):lim.from.getTime();
  }catch(_){statsWarning='Kilometer-langetermijnstatistieken niet beschikbaar.';dailyCoverageFrom=lim.from.getTime();}
  const capacity=ehNum(c.cupra_usable_kwh)||59;
  const analysis=await this._cupraAllHistory(h,c,now,ids,capacity,ttl);
  if(!daily.length&&analysis.fallbackDaily.length){
   daily=analysis.fallbackDaily.filter(d=>d.t>=yearStart.getTime()&&d.t<=now.getTime());
   if(daily.length){
    statsWarning='Kilometertotalen zijn voorlopig uit beschikbare detailhistorie berekend.';
    dailyCoverageFrom=Math.max(yearStart.getTime(),analysis.seg.coverageFrom??yearStart.getTime());
   }
  }
  const {seg,temp,metrics,historyWarning}=analysis;
  const result={key,period:p,limits:lim,capacity,daily,summary:ehCupraDistanceSummary(daily,now,dailyCoverageFrom),dailyCoverageFrom,kmBuckets:ehCupraKmBuckets(daily,p,now),segments:seg.segments,anchors:seg.anchors,homeChargeExcluded:seg.homeChargeExcluded,externalChargeSuspected:seg.externalChargeSuspected,noiseExcluded:seg.noiseExcluded,coverageFrom:seg.coverageFrom,coverageTo:seg.coverageTo,tempGroups:temp.groups,tempBaseline:temp.baseline,metrics,statsWarning,historyWarning,fetched:Date.now()};
  this._cupraInsightsCache.set(key,result);
  if(this._cupraInsightsCache.size>8)this._cupraInsightsCache.delete(this._cupraInsightsCache.keys().next().value);
  if(this._cupraInsightsLoadingKey===key){this._cupraInsightsResult=result;this._cupraInsightsLoadingKey=null;this._schedule();}
 }
 _cupraInsightsHtml(h,c){
  const r=this._cupraInsightsResult?.period===this._cupraInsightsPeriod?this._cupraInsightsResult:null;
  const periodLabel=EH_CUPRA_PERIODS.find(x=>x[0]===this._cupraInsightsPeriod)?.[1]||'Deze maand';
  const fmtKm=v=>Number.isFinite(v)?ehFmt(v,1)+' km':'—';
  const fmtPct=v=>Number.isFinite(v)?(v>0?'+':'')+ehFmt(v,1)+'%':'—';
  const corrLabel=v=>{if(!Number.isFinite(v))return 'Nog onvoldoende meetpunten';const a=Math.abs(v),s=a>=.65?'sterk':a>=.4?'matig':a>=.2?'licht':'zwak';return s+' · r '+ehFmt(v,2);};
  if(!r)return `<section class="cupra-card cupra-insights"><div class="section-title">${ehIcon('chart')} Cupra Insights <span class="only-sim">Analyse</span></div><div class="energy-loading">Cupra- en Alfen-historie analyseren…</div></section>`;
  const s=r.summary||{},m=r.metrics||{};
  const selectedKm=this._cupraInsightsPeriod==='today'?s.today:this._cupraInsightsPeriod==='week'?s.week:this._cupraInsightsPeriod==='year'?s.year:s.month;
  const now=new Date(),from=r.limits?.from||now;
  const day0=new Date(from.getFullYear(),from.getMonth(),from.getDate()),today0=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const days=Math.max(1,Math.round((today0-day0)/86400000)+1),avgDay=Number.isFinite(selectedKm)?selectedKm/days:null;
  const liveTarget=ehRead(h,c.cupra_target_temp),liveOutside=ehRead(h,c.cupra_outside_temp),liveGap=Number.isFinite(liveTarget)&&Number.isFinite(liveOutside)?liveTarget-liveOutside:null;
  const liveClimate=ehMeasure(h,c.cupra_climate_usage,2),liveBoard=ehMeasure(h,c.cupra_onboard_usage,2);
  const currentTempGroup=Number.isFinite(liveOutside)?(r.tempGroups||[]).find(g=>liveOutside>=g.lo&&liveOutside<g.hi&&g.count>=2&&g.km>=20&&Number.isFinite(g.range)):null;
  const expectedNow=currentTempGroup?.range??null;
  const maxRange=Math.max(1,...(r.tempGroups||[]).map(g=>g.range||0));
  const tempRows=(r.tempGroups||[]).filter(g=>g.count>0).map(g=>`<div class="temp-row"><div class="temp-copy"><strong>${ehEsc(g.label)}</strong><span>${ehEsc(ehFmt(g.km,0))} km · ${g.count} segment${g.count===1?'':'en'}</span></div><div class="temp-bar"><i style="width:${Math.max(5,Math.min(100,(g.range||0)/maxRange*100)).toFixed(0)}%"></i></div><div class="temp-values"><strong>${Number.isFinite(g.range)?ehEsc(ehFmt(g.range,0)+' km'):'—'}</strong><span>${Number.isFinite(g.kwh100)?ehEsc(ehFmt(g.kwh100,1)+' kWh/100 km'):'—'}${Number.isFinite(g.delta)?' · '+ehEsc(fmtPct(g.delta))+' vs 15–20°C':''}</span></div></div>`).join('');
  const coverage=r.coverageFrom?`${new Date(r.coverageFrom).toLocaleDateString('nl-NL',{day:'numeric',month:'short',year:'numeric'})} – ${new Date(r.coverageTo||Date.now()).toLocaleDateString('nl-NL',{day:'numeric',month:'short',year:'numeric'})}`:'Geen detailhistorie';
  const warnings=[r.statsWarning,r.historyWarning].filter(Boolean).map(x=>`<p class="plan-warning">${ehEsc(x)}</p>`).join('');
  return `<section class="cupra-card cupra-insights">
   <div class="section-title">${ehIcon('chart')} Cupra Insights <span class="only-sim">Praktijkanalyse</span></div>
   <p class="subtle">Kilometers per gekozen periode; praktijkverbruik en temperatuurvoorspelling gebruiken alle beschikbare historische ritten (onafhankelijk van de periodeknoppen). Laadsegmenten en meetruis worden gefilterd. Oudere detaildata kan door Recorder-retentie ontbreken.</p>
   <div class="insight-periods">${EH_CUPRA_PERIODS.map(([id,label])=>`<button type="button" data-eh-cupra-insight-period="${id}" class="${this._cupraInsightsPeriod===id?'chosen':''}">${label}</button>`).join('')}</div>
   <div class="km-summary"><div><small>Vandaag</small><strong>${fmtKm(s.today)}</strong></div><div><small>Deze week</small><strong>${fmtKm(s.week)}</strong></div><div><small>Deze maand</small><strong>${fmtKm(s.month)}</strong></div><div><small>Dit jaar</small><strong>${fmtKm(s.year)}</strong></div></div>
   <div class="insight-headline"><div><small>${ehEsc(periodLabel)}</small><strong>${fmtKm(selectedKm)}</strong><span>${Number.isFinite(avgDay)?ehEsc(ehFmt(avgDay,1)+' km gemiddeld per kalenderdag'):'Gemiddelde nog niet beschikbaar'}</span></div><div class="quality-pill ${String(m.quality||'').toLowerCase()}"><small>Datakwaliteit</small><strong>${ehEsc(m.quality||'Beperkt')}</strong></div></div>
   ${ehCupraKmChart(r.kmBuckets,this._cupraInsightsPeriod)}
   <div class="insight-metrics"><div><small>Praktijkactieradius</small><strong>${Number.isFinite(m.range)?ehEsc(ehFmt(m.range,0)+' km'):'—'}</strong><span>Uit ${ehEsc(ehFmt(m.km||0,0))} km geldige segmenten</span></div><div><small>Geschat verbruik</small><strong>${Number.isFinite(m.kwh100)?ehEsc(ehFmt(m.kwh100,1)+' kWh/100 km'):'—'}</strong><span>SOC-verlies × ${ehEsc(ehFmt(r.capacity,0))} kWh</span></div><div><small>Cupra voorspelling</small><strong>${Number.isFinite(m.predicted)?ehEsc(ehFmt(m.predicted,0)+' km'):'—'}</strong><span>${Number.isFinite(m.rangeDelta)?'Praktijk '+ehEsc(fmtPct(m.rangeDelta)):'Nog geen vergelijking'}</span></div><div><small>Verwacht bij huidige temperatuur</small><strong>${Number.isFinite(expectedNow)?ehEsc(ehFmt(expectedNow,0)+' km'):'—'}</strong><span>${currentTempGroup?ehEsc(currentTempGroup.label+' · '+ehFmt(currentTempGroup.km,0)+' km historie'):'Nog onvoldoende data in deze temperatuurklasse'}</span></div><div><small>Laadefficiëntie thuis</small><strong>${Number.isFinite(m.chargeEfficiency)&&m.chargeSamples>=2?ehEsc(ehFmt(m.chargeEfficiency,1)+'%'):'—'}</strong><span>${m.chargeSamples?`${m.chargeSamples} Alfen/Cupra intervallen · ${ehEsc(ehFmt(m.wallKwh||0,1))} kWh muur`:'Nog onvoldoende gekoppelde laadintervallen'}</span></div><div><small>Geldige segmenten</small><strong>${m.valid?.length??0}</strong><span>${ehEsc(coverage)}</span></div></div>
   <div class="insight-panel temp-trend-panel"><div class="detail-small-title">Temperatuur → praktijkactieradius</div>${ehCupraTempRangeChart(r.tempGroups,liveOutside)}<p class="detail-muted">De gemarkeerde klasse bevat de huidige buitentemperatuur. De lijn toont jouw eigen historische praktijkrange per temperatuurklasse.</p></div>
   <div class="insight-split"><div class="insight-panel"><div class="detail-small-title">Temperatuurklassen</div>${tempRows||'<p class="detail-muted">Nog onvoldoende geldige ritsegmenten om temperatuurklassen te vullen.</p>'}<p class="detail-muted">Referentie voor percentages is 15–20°C zodra daar voldoende kilometers beschikbaar zijn.</p></div>
   <div class="insight-panel"><div class="detail-small-title">Klimaatvraag & doeltemperatuur</div><div class="climate-grid"><div><span>Buiten gemiddeld</span><strong>${Number.isFinite(m.avgTemp)?ehEsc(ehFmt(m.avgTemp,1)+' °C'):'—'}</strong></div><div><span>Doeltemperatuur gemiddeld</span><strong>${Number.isFinite(m.avgTarget)?ehEsc(ehFmt(m.avgTarget,1)+' °C'):'—'}</strong></div><div><span>Gemiddeld klimaatverschil</span><strong>${Number.isFinite(m.avgDemand)?ehEsc(ehFmt(m.avgDemand,1)+' °C'):'—'}</strong></div><div><span>Nu: doel − buiten</span><strong>${Number.isFinite(liveGap)?ehEsc((liveGap>0?'+':'')+ehFmt(liveGap,1)+' °C'):'—'}</strong></div><div><span>Cupra klimaatwaarde</span><strong>${ehEsc(liveClimate.text)}</strong></div><div><span>Cupra boordnetwaarde</span><strong>${ehEsc(liveBoard.text)}</strong></div></div><div class="correlation-row"><span>Buitentemperatuur ↔ verbruik</span><strong>${ehEsc(corrLabel(m.tempCorrelation))}</strong></div><div class="correlation-row"><span>|Doel − buiten| ↔ verbruik</span><strong>${ehEsc(corrLabel(m.gapCorrelation))}</strong></div><p class="detail-muted">De doeltemperatuur is het ingestelde cabine-setpoint, niet de gemeten binnentemperatuur. De samenhang is daarom indicatief en bewijst geen oorzaak op zichzelf.</p></div></div>
   <div class="insight-quality"><span>Thuisladen uitgesloten: <strong>${r.homeChargeExcluded||0}</strong></span><span>Vermoedelijk extern laden: <strong>${r.externalChargeSuspected||0}</strong></span><span>Meetruis uitgesloten: <strong>${r.noiseExcluded||0}</strong></span><span>Cupra meetpunten: <strong>${r.anchors||0}</strong></span></div>
   ${warnings}
   <p class="subtle"><strong>Gemeten:</strong> kilometerstand, SOC, Cupra-range, buitentemperatuur, doeltemperatuur en Alfen-laadenergie. <strong>Afgeleid:</strong> praktijkrange en kWh/100 km. Klimaatverbruik en boordnet blijven contextwaarden totdat hun semantiek in de Cupra-feed volledig is gevalideerd.</p>
  </section>`;
 }
 _cupraHtml(h,c){
  const soc=ehRead(h,c.cupra);
  const rangeState=ehCupraByName(h,c.cupra_range,'Actieradius');
  const mileageState=ehCupraByName(h,c.cupra_mileage,'Kilometerstand');
  const chargeStatusState=ehCupraByName(h,c.cupra_charge_status,'Laadstatus');
  const chargePowerState=ehCupraByName(h,c.cupra_charge_power,'Laadvermogen');
  const remainingChargeState=ehCupraByName(h,c.cupra_remaining_charge_time,'Resterende laadtijd');
  const lockState=ehCupraByName(h,c.cupra_locked,'Deuren vergrendeld');
  const cableState=ehCupraByName(h,c.cupra_cable,'Laadkabel aangesloten');
  const chargingState=ehCupraByName(h,c.cupra_charging,'Aan het laden');
  const chargedEnergyState=ehCupraByName(h,c.cupra_charged_energy,'Geladen energie');
  const scenarioState=ehCupraByName(h,c.cupra_charge_scenario,'Laadscenario');
  const scheduleState=ehCupraByName(h,c.cupra_charge_schedule,'Laadschema');
  const speedState=ehCupraByName(h,c.cupra_charge_speed,'Laadsnelheid');
  const portalState=ehCupraByName(h,c.cupra_portalfeed,'Status portaalfeed')||ehCupraByName(h,c.cupra_portalfeed,'Status portalfeed');
  const doorsState=ehCupraByName(h,c.cupra_doors,'Portieren');
  const outsideTempState=ehCupraByName(h,c.cupra_outside_temp,'Buitentemperatuur');
  const targetTempState=ehCupraByName(h,c.cupra_target_temp,'Doeltemperatuur');
  const climateUsageState=ehCupraByName(h,c.cupra_climate_usage,'Klimaatverbruik');
  const chargeTargetState=ehCupraByName(h,c.cupra_charge_target,'Laaddoel');
  const onboardUsageState=ehCupraByName(h,c.cupra_onboard_usage,'Verbruik boordnet');
  const connectionState=c.cupra_connection?h.states?.[c.cupra_connection]:null;

  const range=rangeState?ehNum(rangeState.state):null;
  const mileage=mileageState?ehNum(mileageState.state):null;
  const chargeStatus=ehCupraText(chargeStatusState,0);
  const chargePowerVehicle=ehCupraText(chargePowerState,1);
  const remainingCharge=ehCupraText(remainingChargeState,0);
  const lockStatus=ehCupraText(lockState,0);
  const cableStatus=ehCupraText(cableState,0);
  const chargingStatus=ehCupraText(chargingState,0);
  const chargedEnergy=ehCupraText(chargedEnergyState,1);
  const chargeScenario=ehCupraText(scenarioState,0);
  const chargeSchedule=ehCupraText(scheduleState,0);
  const chargeSpeed=ehCupraText(speedState,1);
  const portalfeed=ehCupraText(portalState,0);
  const doors=ehCupraText(doorsState,0);
  const outsideTemp=ehCupraText(outsideTempState,1);
  const targetTemp=ehCupraText(targetTempState,1);
  const climateUsage=ehCupraText(climateUsageState,2);
  const chargeTarget=ehCupraText(chargeTargetState,0);
  const onboardUsage=ehCupraText(onboardUsageState,2);
  const connected=connectionState?.state??portalState?.state??null;
  const ev=ehW(h,c.laden),amps=ehRead(h,c.stroom),charging=ev!==null&&ev>80;
  const target=this._targetSoc;
  const capacity=ehNum(c.cupra_usable_kwh),hasCapacity=soc!==null&&capacity!==null&&capacity>0;
  const derived=hasCapacity?Math.max(0,(target-soc)/100*capacity):null;
  const need=this._simNeed??(derived??Number(c.sim_laadbehoefte_kwh)),power=this._simPower??Number(c.sim_laadvermogen_kw);
  const tariff=ehPricesForDay(h,c,new Date());
  const forecast=ehHourlyFromPrices(tariff.quarters,tariff.hourly.length?tariff.hourly:ehForecast(h,c.prijs));
  const prices=forecast.filter(x=>x.t&&Number.isFinite(Date.parse(x.t))).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
  const houseReading=eh24ChargeReading(h,c.huis);
  const planOpts={
     fuseAmp:eh17N(c.fuse_amp)??40,chargerAmp:eh17N(c.charger_amp)??32,
     reserveAmp:eh17N(c.reserve_amp)??2,houseW:houseReading.watts,houseQuality:houseReading.quality,
     efficiency:eh17N(c.ev_charge_efficiency)??.9,
     solar:eh17Solar(h,c.pv_forecast),
     exportCompensation:eh17N(c.export_compensation_eur_kwh)
   };
  const planned=eh17Plan(prices,new Date(),this._departure,need,power,this._chargeMode,planOpts);
  const safeImg=ehValidHero(c.cupra_image)?c.cupra_image:'';
  const connectionText=connected===null||connected===undefined?'Niet gekoppeld':String(connected);
  const chargeLabel=ev===null?'Alfen niet beschikbaar':charging?'Auto laadt via Alfen':'Geen laadsessie actief';
  // De planner blijft bij het kiezen van uren; kwartiergrafiek is voor inzicht, niet voor laadcommando's.
  const now=new Date(),todayPrices=tariff.day;
  const lowest=tariff.low,highest=tariff.high,current=tariff.currentQ?.p??tariff.currentHour;
  const pct=lowest&&highest&&current!==null&&highest.p>lowest.p?(current-lowest.p)/(highest.p-lowest.p):null;
  const assessment=pct===null?'Geen vergelijking':pct<1/3?'Goedkoop':pct>2/3?'Duur':'Gemiddeld';
  const inPlan=t=>(planned.selected||[]).some(slot=>t>=slot.slotStart&&t<slot.slotEnd);
  const chartPrices=tariff.quarters.length?tariff.quarters.filter(o=>{const t=Date.parse(o.t);return t>=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime()&&t<new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime();}):prices.filter(o=>Date.parse(o.t)>=Date.now()-3600000).slice(0,48);
  const filtered=chartPrices.length?chartPrices:prices.slice(0,24);
  const priceMin=filtered.length?Math.min(...filtered.map(o=>o.p)):0,priceMax=filtered.length?Math.max(...filtered.map(o=>o.p)):0;
  const priceSpan=Math.max(.01,priceMax-priceMin);
  const selectedTime=this._cupraPriceSelected;
  const ix=filtered.length?Math.max(0,selectedTime===null?filtered.findIndex(o=>Date.parse(o.t)<=Date.now()&&Date.parse(o.t)+(tariff.quarters.length?900000:3600000)>Date.now()):filtered.findIndex(o=>Date.parse(o.t)===selectedTime)):0;
  const inspected=filtered[Math.max(0,ix)];
  const quarter=!!tariff.quarters.length,minutes=quarter?15:60;
  const forecastBars=filtered.length?`<div class="cupra-price-bars ${quarter?'is-quarter':''}" aria-label="${quarter?'Zonneplan kwartierprijzen vandaag':'Zonneplan uurprijzen'}">${filtered.map((o,i)=>{
    const t=Date.parse(o.t),active=inPlan(t),hh=ehClock(t);
    const height=12+(o.p-priceMin)/priceSpan*88;
    return `<button type="button" data-eh-cupra-price="${t}" class="cupra-price-slot ${i===Math.max(0,ix)?'inspected':''}" aria-label="${ehEsc(hh)}, ${ehEsc(ehMoney(o.p))} per kWh${active?', ingepland':''}" title="${ehEsc(hh)} · ${ehEsc(ehMoney(o.p))}/kWh"><span class="cupra-price-fill ${active?'selected':''}" style="height:${Math.max(8,Math.min(100,height)).toFixed(0)}%"></span></button>`;
  }).join('')}</div><div class="cupra-price-axis"><span>${ehEsc(ehClock(Date.parse(filtered[0].t)))}</span><span>${ehEsc(ehClock(Date.parse(filtered.at(-1).t)))}</span></div>
  <input class="cupra-price-timeline" type="range" data-eh-cupra-range="1" min="0" max="${Math.max(0,filtered.length-1)}" step="1" value="${Math.max(0,ix)}" aria-label="Kies kwartier of uur in de prijsgrafiek"/>
  <div class="cupra-price-inspect"><strong>${ehEsc(ehClock(Date.parse(inspected.t)))}–${ehEsc(ehClock(Date.parse(inspected.t)+minutes*60000))}</strong><span>${ehEsc(ehMoney(inspected.p))}/kWh</span><span>${inPlan(Date.parse(inspected.t))?'In laadplanning':'Niet ingepland'}</span></div>`:
  `<p class="detail-muted">Geen Zonneplan-tarieven beschikbaar. De planner verzint geen prijzen.</p>`;
  const countText=todayPrices.length?`${todayPrices.length} van ${tariff.expected} kwartieren beschikbaar${tariff.complete?' · volledige dag':' · onvolledige dag'}`:'Kwartierprijzen nog niet beschikbaar';
  const priceCompare=`<div class="cupra-price-compare"><div><small>Laagste kwartier vandaag</small><strong>${lowest?ehEsc(ehMoney(lowest.p)):'—'}</strong><span>${lowest?.t?ehEsc(ehClock(Date.parse(lowest.t))):'Tijd onbekend'}</span></div><div><small>Prijs nu</small><strong>${current===null?'—':ehEsc(ehMoney(current))}</strong><span>${ehEsc(assessment)}${!tariff.currentQ?' · uurtarief':''}</span></div><div><small>Hoogste kwartier vandaag</small><strong>${highest?ehEsc(ehMoney(highest.p)):'—'}</strong><span>${highest?.t?ehEsc(ehClock(Date.parse(highest.t))):'Tijd onbekend'}</span></div></div><p class="subtle">${ehEsc(countText)} · Tarieven zoals aangeleverd door de Zonneplan-sensor; controleer of belastingen en btw in deze sensor inbegrepen zijn. Groene staven zijn ingeplande uren.</p>`;
  const chargePowerVehicleText=chargePowerVehicle;
  const remainingChargeText=remainingCharge;
  const mileageText=mileage===null?'—':ehFmt(mileage,0)+' km';
  const statusText=chargeStatus==='—'?(charging?'Laden':'Niet laden'):chargeStatus;
  const vehicleStatusCards=`<div class="vehicle-status-grid"><div class="vehicle-status"><span class="vehicle-status-icon mint">${ehIcon('battery')}</span><small>Accu</small><strong>${soc===null?'—':ehEsc(ehFmt(soc,0)+'%')}</strong><em>Cupra EU Data Act</em></div><div class="vehicle-status"><span class="vehicle-status-icon blue">${ehIcon('car')}</span><small>Actieradius</small><strong>${range===null?'—':ehEsc(ehFmt(range,0)+' km')}</strong><em>${range===null?'Wachten op data':'Elektrisch bereik'}</em></div><div class="vehicle-status"><span class="vehicle-status-icon mint">${ehIcon('shield')}</span><small>Auto</small><strong>${ehEsc(lockStatus)}</strong><em>Vergrendeling</em></div><div class="vehicle-status"><span class="vehicle-status-icon blue">${ehIcon('sun')}</span><small>Buiten</small><strong>${ehEsc(outsideTemp)}</strong><em>Temperatuur</em></div></div>`;
  const vehicleDetails=`<section class="vehicle-details ${this._cupraDetails?'open':''}"><div class="vehicle-detail-grid"><div><span>Kilometerstand</span><strong>${ehEsc(mileageText)}</strong></div><div><span>Laaddoel</span><strong>${ehEsc(chargeTarget)}</strong></div><div><span>Doeltemperatuur</span><strong>${ehEsc(targetTemp)}</strong></div><div><span>Klimaatverbruik</span><strong>${ehEsc(climateUsage)}</strong></div><div><span>Verbruik boordnet</span><strong>${ehEsc(onboardUsage)}</strong></div><div><span>Laadstatus</span><strong>${ehEsc(statusText)}</strong></div><div><span>Resterende laadtijd</span><strong>${ehEsc(remainingChargeText)}</strong></div><div><span>Laadvermogen</span><strong>${ehEsc(chargePowerVehicleText)}</strong></div><div><span>Geladen energie</span><strong>${ehEsc(chargedEnergy)}</strong></div><div><span>Laadsnelheid</span><strong>${ehEsc(chargeSpeed)}</strong></div><div><span>Laadkabel</span><strong>${ehEsc(cableStatus)}</strong></div><div><span>Aan het laden</span><strong>${ehEsc(chargingStatus)}</strong></div><div><span>Laadscenario</span><strong>${ehEsc(chargeScenario)}</strong></div><div><span>Laadschema</span><strong>${ehEsc(chargeSchedule)}</strong></div><div><span>Deuren vergrendeld</span><strong>${ehEsc(lockStatus)}</strong></div><div><span>Portieren</span><strong>${ehEsc(doors)}</strong></div><div><span>Status portaalfeed</span><strong>${ehEsc(portalfeed)}</strong></div><div><span>Verbinding</span><strong>${ehEsc(connectionText)}</strong></div></div><p class="subtle">Niet beschikbare VW Group Connect-waarden blijven als — staan; zodra Cupra ze weer levert, verschijnen ze automatisch.</p></section>`;
  const dateOk=Number.isFinite(Date.parse(this._departure))&&Date.parse(this._departure)>Date.now();
  const plannedMarkup=planned.error?`<p class="plan-warning">${ehEsc(planned.error)}</p>`:`
    ${planned.remaining>0.1?`<p class="plan-warning">Niet genoeg ingeplande capaciteit vóór vertrek met de beschikbare prijzen en het gekozen laadvermogen.</p>`:''}
    <details class="eh32-hours"><summary>Geplande uren bekijken</summary><div class="scheduled-hours">${planned.selected.length?planned.selected.map(x=>`<div class="scheduled-hour"><span>${ehEsc(ehClock(x.slotStart))}–${ehEsc(ehClock(x.slotEnd))}</span><span>${ehEsc(ehFmt(x.kWh,1))} kWh</span><strong>${ehEsc(ehMoney(x.price))}/kWh</strong></div>`).join(''):'<p class="detail-muted">Geen uren geselecteerd in deze modus.</p>'}</div></details>`;
  return this._view==='cupra' ? `<main class="cupra-page">
    <div class="cupra-head"><button class="back-button" type="button" data-eh-page="overview" aria-label="Terug naar overzicht">←</button><div><div class="cupra-kicker">ENERGIEHUIS · VOERTUIG &amp; INZICHTEN</div><h2>Cupra Born</h2></div></div>
    <section class="cupra-hero">
      ${safeImg?`<div class="cupra-photo" style="background-image:linear-gradient(180deg,#06162433,#071522),url('${ehEsc(safeImg)}')"></div>`:`<div class="cupra-car-icon">${ehIcon('car')}</div>`}
      <div class="cupra-car-copy"><div class="cupra-name">Cupra Born</div><div class="cupra-connection">${ehEsc(connectionText)}</div><div class="cupra-big">${soc===null?'—':ehEsc(ehFmt(soc,0)+'%')} <span>SOC</span></div><div class="cupra-small">${range===null?'Actieradius niet gekoppeld':ehEsc(ehFmt(range,0)+' km geschatte actieradius')}</div></div>
    </section>
    <section class="cupra-card vehicle-dashboard"><div class="section-title">${ehIcon('car')} Huidige voertuigstatus</div>${vehicleStatusCards}<button type="button" class="vehicle-details-toggle" data-eh-cupra-details="1">${this._cupraDetails?'Minder details':'Uitgebreide voertuigdetails'} <span>${this._cupraDetails?'↑':'→'}</span></button>${vehicleDetails}</section>
    ${this._cupraInsightsHtml(h,c)}
  </main>` : `<main class="cupra-page charge-page">
    <div class="cupra-head"><button class="back-button" type="button" data-eh-page="overview" aria-label="Terug naar overzicht">←</button><div><div class="cupra-kicker">ENERGIEHUIS · LAADOMGEVING</div><h2>Slim laden</h2></div></div>
    <section class="cupra-card"><div class="section-label">Huidige laadstatus</div><div class="charge-row"><div><strong class="charge-power">${ehEsc(ehPower(ev))}</strong><p>${ehEsc(chargeLabel)}</p></div><div class="charge-amps"><span>Stroom L1</span><strong>${amps===null?'—':ehEsc(ehFmt(amps,1)+' A')}</strong></div></div><div class="charge-progress"><div style="width:${Math.min(100,Math.max(0,soc??0))}%"></div></div><p class="subtle">Actueel laadvermogen: Alfen · ${soc===null?'Cupra-accustand niet gekoppeld':'Accustand: Cupra-sensor'}</p></section>
    <section class="cupra-card"><div class="section-title">${ehIcon('clock')} Jouw laadscenario</div>
      <div class="planning-inputs">
        <label class="plan-input"><span>Gewenste accustand <b>${target}%</b></span><input data-eh-target="1" type="range" min="50" max="100" step="5" value="${target}" aria-label="Gewenst accupercentage"/></label>
        <label class="plan-input"><span>Vertrektijd <small>voorbeeld, aanpasbaar</small></span><input type="datetime-local" data-eh-departure="1" value="${ehEsc(this._departure)}" aria-label="Vertrektijd"/></label>
        <div class="plan-input-row"><label class="plan-input"><span>Laadbehoefte (kWh)</span><input type="number" min="1" max="100" step="1" data-eh-kwh="1" value="${ehEsc(need)}" aria-label="Te laden energie in kilowattuur"/></label><label class="plan-input"><span>Laadvermogen (kW)</span><input type="number" min="1.4" max="7.4" step="0.01" data-eh-kw="1" value="${ehEsc(power)}" aria-label="Aangenomen laadvermogen"/></label></div>
      </div>
      ${eh23ChargePowerHtml(this,h,c,prices,need,planOpts)}
      <p class="subtle">${hasCapacity?`Behoefte berekend uit ${ehFmt(soc,0)}% SOC, ${ehFmt(capacity,1)} kWh bruikbare accucapaciteit en doel ${target}%. ${this._simNeed!==null?'Handmatige laadbehoefte gaat voor.':''}`:(soc===null?'De Cupra-SOC is nog niet gekoppeld. Vul daarom je laadbehoefte zelf in.':`Voor een automatische behoefteberekening bij ${target}% is cupra_usable_kwh nodig. Vul voorlopig zelf de laadbehoefte in.`)} Deze waarden zijn uitsluitend een simulatie.</p>
    </section>
    <section class="cupra-card"><div class="section-title">${ehIcon('bolt')} Planningsmodus</div><div class="mode-grid">
      ${[['slim','leaf','Slim','Goedkoopste uren'],['direct','bolt','Direct','Eerstvolgende uren'],['sun','sun','Zon','PV-prognose nodig'],['pause','dots','Pauze','Geen uren plannen']].map(([id,icon,title,desc])=>`<button class="mode ${this._chargeMode===id?'active':''}" data-eh-mode="${id}" type="button" ${id==='sun'&&!eh17Solar(h,c.pv_forecast).length?'disabled title="Koppel een betrouwbare zonneprognose"':''}>${ehIcon(icon)}<strong>${title}</strong><span>${desc}</span></button>`).join('')}
    </div></section>
    <section class="cupra-card"><div class="section-title">${ehIcon('euro')} Verwachte laadplanning</div><p class="subtle">Tarieven komen uit je Zonneplan-forecast. Inclusief laadverlies (rendement ${ehFmt(Math.min(1,Math.max(.5,eh17N(c.ev_charge_efficiency)??.9))*100,0)}%); exclusief vaste kosten en tariefverschillen. Geen laadopdrachten worden verzonden.</p>${priceCompare}${forecastBars}${plannedMarkup}</section>
    <div class="cupra-safety">${ehIcon('shield')} <span><strong>Veilige simulatie.</strong> Deze knoppen regelen de Alfen niet. Werkelijke laadsnelheid kan variëren door de 1×40A-aansluiting, huisverbruik, laadpaalinstellingen en Active Load Balancing. Er worden geen laadcommando’s verstuurd.</span></div>
  </main>`;
 }

 _batteryHtml(h,c){
  const soc=ehRead(h,c.battery_soc||c.batterij);
  const kwh=ehMeasure(h,c.battery_soc_kwh,1);
  const status=c.battery_status?h?.states?.[c.battery_status]?.state:'';
  const saveDay=ehRead(h,c.battery_saving_day),saveMonth=ehRead(h,c.battery_saving_month),saveYear=ehRead(h,c.battery_saving_year);
  const without=ehRead(h,c.battery_cost_without_month),withBattery=ehRead(h,c.battery_cost_with_month);
  const avoided=ehRead(h,c.battery_avoided_import_month),gridCost=ehRead(h,c.battery_grid_charge_cost_month),lost=ehRead(h,c.battery_lost_export_month);
  const tile=(label,value,icon,tone='blue',sub='')=>`<div class="subcard"><div class="sub-icon ${tone}">${ehIcon(icon)}</div><small>${ehEsc(label)}</small><strong>${value}</strong>${sub?`<span>${ehEsc(sub)}</span>`:''}</div>`;
  return `<main class="subpage">
   <div class="subpage-head"><div><div class="eyebrow">Vaste 10-kWh-simulatie uit Home Assistant</div><h2>Batterij</h2><p>De cijfers hieronder horen bij het 10-kWh-model. De vergelijking van 5, 10 en 15 kWh staat verderop.</p></div><div class="soc-ring"><strong>${soc===null?'—':ehFmt(soc,0)+'%'}</strong><span>${ehEsc(kwh.text)}</span></div></div>
   <div class="subgrid three">
    ${tile('Zonder batterij',without===null?'—':ehEuro2(without),'home','peach')}
    ${tile('Met batterij',withBattery===null?'—':ehEuro2(withBattery),'battery','blue')}
    ${tile('Netto bespaard',saveMonth===null?'—':ehEuro2(saveMonth),'euro',saveMonth!==null&&saveMonth>=0?'mint':'peach','deze maand')}
   </div>
   <section class="subsection"><div class="section-title">${ehIcon('battery')} Batterijstatus</div><div class="subrows">
    <div><span>Status</span><strong>${ehEsc(status||'Niet beschikbaar')}</strong></div>
    <div><span>Inhoud</span><strong>${ehEsc(kwh.text)}</strong></div>
    <div><span>Besparing vandaag</span><strong>${saveDay===null?'—':ehEuro2(saveDay)}</strong></div>
    <div><span>Besparing dit jaar</span><strong>${saveYear===null?'—':ehEuro2(saveYear)}</strong></div>
   </div></section>
   <section class="subsection"><div class="section-title">${ehIcon('euro')} Financiële uitsplitsing deze maand</div><div class="subrows">
    <div><span>Vermeden inkoop</span><strong class="positive">${avoided===null?'—':'+ '+ehEuro2(avoided)}</strong></div>
    <div><span>Kosten netladen</span><strong>${gridCost===null?'—':'− '+ehEuro2(gridCost)}</strong></div>
    <div><span>Gemiste teruglevering</span><strong>${lost===null?'—':'− '+ehEuro2(lost)}</strong></div>
   </div><p class="subtle">Contractvoordeel van Zonneplan telt hier bewust niet mee. Zo blijft de batterij-businesscase zuiver.</p></section>
  </main>`;
 }
 _costsHtml(h,c){
  const current=ehCurrentPrice(h,c.prijs);
  const zpDay=ehRead(h,c.cost_zonneplan_day),zpMonth=ehRead(h,c.cost_zonneplan_month),zpYear=ehRead(h,c.cost_zonneplan_year);
  const vf1=ehRead(h,c.cost_vattenfall_1_month),vf3=ehRead(h,c.cost_vattenfall_3_month);
  const vf1Year=ehRead(h,c.cost_vattenfall_1_year),vf3Year=ehRead(h,c.cost_vattenfall_3_year);
  const smart=ehRead(h,c.saving_smart_month);
  const adv1=(vf1!==null&&zpMonth!==null)?vf1-zpMonth:null;
  const adv3=(vf3!==null&&zpMonth!==null)?vf3-zpMonth:null;
  const adv1Year=(vf1Year!==null&&zpYear!==null)?vf1Year-zpYear:null;
  const adv3Year=(vf3Year!==null&&zpYear!==null)?vf3Year-zpYear:null;
  const advLabel=(v,years)=>v===null?`Verschil vs ${years} jaar`:(v>=0?`Voordeel vs ${years} jaar`:`Nadeel vs ${years} jaar`);
  const advClass=v=>v===null?'':(v>=0?'positive':'negative');
  const costResult=this._costCompareResult?.period===this._costComparePeriod?this._costCompareResult:null;
  const costPoints=costResult?.points||[];
  const costSelected=costPoints.length?costPoints.reduce((a,b)=>this._costCompareSelectedTime===null||this._costCompareSelectedTime===undefined?(b.t>a.t?b:a):(Math.abs(b.t-this._costCompareSelectedTime)<Math.abs(a.t-this._costCompareSelectedTime)?b:a),costPoints[0]):null;
  const costDate=costSelected?(this._costComparePeriod==='month'?new Date(costSelected.t).toLocaleDateString('nl-NL',{day:'numeric',month:'long'}):new Date(costSelected.t).toLocaleDateString('nl-NL',{month:'long',year:'numeric'})):'—';
  const costGraph=costResult?.error?`<p class="plan-warning">${ehEsc(costResult.error)}</p>`:!costResult?'<div class="energy-loading">Kostenhistorie ophalen…</div>':ehCostCompareChart(costResult,costSelected?.t??Date.now());
  const tile=(label,value,icon,tone='blue',sub='')=>`<div class="subcard"><div class="sub-icon ${tone}">${ehIcon(icon)}</div><small>${ehEsc(label)}</small><strong>${value}</strong>${sub?`<span>${ehEsc(sub)}</span>`:''}</div>`;
  return `<main class="subpage">
   <div class="subpage-head"><div><div class="eyebrow">Kosten & besparing</div><h2>Energiekosten</h2><p>Zonneplan, je stroomkosten en opgeslagen leveranciers op één plek.</p></div><div class="price-badge"><small>Nu</small><strong>${current===null?'—':ehMoney(current)}</strong><span>€/kWh</span></div></div>
   <div class="subgrid three">
    ${tile('Zonneplan vandaag',zpDay===null?'—':ehEuro2(zpDay),'euro','blue')}
    ${tile('Zonneplan maand',zpMonth===null?'—':ehEuro2(zpMonth),'euro','mint')}
    ${tile('Slimme timing',smart===null?'—':ehEuro2(smart),'clock','gold','bespaard deze maand')}
   </div>
   ${ehCompareHtml(this)}
  </main>`;
 }
 _moreHtml(h,c){
  const gasDay=ehMeasure(h,c.gas_today,2),gas=ehMeasure(h,c.gas,2);
  const waterDay=ehMeasure(h,c.water_today,1),water=ehMeasure(h,c.water,1),flow=ehMeasure(h,c.water_flow,2);
  return `<main class="subpage">
   <div class="subpage-head"><div><div class="eyebrow">HomeWizard-stijl</div><h2>Gas & water</h2><p>Dagverbruik, meterstanden en live debiet zodra de bijbehorende entiteiten zijn gekoppeld.</p></div></div>
   <div class="utility-grid">
    <section class="utility-card gas-card"><div class="utility-head"><div class="sub-icon peach">${ehIcon('gas')}</div><div><small>Gas</small><strong>${ehEsc(gasDay.n!==null?gasDay.text:gas.text)}</strong></div></div><div class="subrows"><div><span>Vandaag</span><strong>${ehEsc(gasDay.text)}</strong></div><div><span>Meterstand</span><strong>${ehEsc(gas.text)}</strong></div></div></section>
    <section class="utility-card water-card"><div class="utility-head"><div class="sub-icon blue">${ehIcon('water')}</div><div><small>Water</small><strong>${ehEsc(waterDay.n!==null?waterDay.text:(flow.n!==null?flow.text:water.text))}</strong></div></div><div class="subrows"><div><span>Vandaag</span><strong>${ehEsc(waterDay.text)}</strong></div><div><span>Live debiet</span><strong>${ehEsc(flow.text)}</strong></div><div><span>Meterstand</span><strong>${ehEsc(water.text)}</strong></div></div></section>
   </div>
   <section class="subsection"><div class="section-title">${ehIcon('info')} Sensorstatus</div><div class="subrows">
    <div><span>Gas dagtotaal</span><strong>${c.gas_today&&h.states?.[c.gas_today]?'Gekoppeld':'Nog koppelen'}</strong></div>
    <div><span>Water dagtotaal</span><strong>${c.water_today&&h.states?.[c.water_today]?'Gekoppeld':'Nog koppelen'}</strong></div>
    <div><span>Water live debiet</span><strong>${c.water_flow&&h.states?.[c.water_flow]?'Gekoppeld':'Nog koppelen'}</strong></div>
   </div><p class="subtle">De exacte water-entiteiten verschillen per HomeWizard-installatie. Daarom verzint Energiehuis geen entiteitsnamen: je koppelt ze expliciet in de kaartconfiguratie.</p></section>
  </main>`;
 }
 _render(){
  if(!this.config || !this._hass)return;
  const h=this._hass,c=this.config;
  const net=ehW(h,c.net),pv=ehW(h,c.zonnepanelen),ev=ehW(h,c.laden),house=ehW(h,c.huis);
  const price=ehCurrentPrice(h,c.prijs),soc=ehRead(h,c.cupra),battery=ehRead(h,c.batterij);
  const amps=ehRead(h,c.stroom),weather=c.weather?h?.states?.[c.weather]:null;
  const im=ehRead(h,c.import),ex=ehRead(h,c.export);
  const gasDay=ehMeasure(h,c.gas_today,2),gasMeter=ehMeasure(h,c.gas,2);
  const waterDay=ehMeasure(h,c.water_today,1),waterFlow=ehMeasure(h,c.water_flow,2),waterMeter=ehMeasure(h,c.water,1);
  const gasText=gasDay.n!==null?gasDay.text:gasMeter.text;
  const gasSub=gasDay.n!==null?'Vandaag':gasMeter.n!==null?'Meterstand · dagtotaal nog koppelen':'Sensor nog niet gekoppeld';
  const waterText=waterDay.n!==null?waterDay.text:(waterFlow.n!==null?waterFlow.text:waterMeter.text);
  const waterSub=waterDay.n!==null?'Vandaag':waterFlow.n!==null?'Live debiet · dagtotaal nog koppelen':waterMeter.n!==null?'Meterstand · dagtotaal nog koppelen':'Sensor nog niet gekoppeld';
  const netLabel=net===null?'Niet beschikbaar':net< -50?'Teruglevering':net>50?'Afname van het net':'In balans';
  const charging=ev!==null&&ev>80;
  const iconCard=(type,label,value,sub,color)=>({grid:c.net,sun:c.zonnepanelen,home:c.huis,euro:c.prijs,car:c.cupra||c.laden,battery:c.batterij,gas:c.gas||c.gas_today,water:c.water||c.water_today||c.water_flow}[type])?`<button type="button" class="metric metric-${type}" data-eh-detail="${type}" aria-expanded="${this._detail===type}"><div class="metric-symbol ${color}">${ehIcon(type)}</div><div class="metric-copy"><div class="metric-label">${ehEsc(label)}</div><div class="metric-value ${color}">${ehEsc(value)}</div><div class="metric-sub">${ehEsc(sub)}</div></div><span class="metric-chevron">${ehIcon('chevron')}</span></button>`:'';
  const cSoc=soc!==null?`${ehFmt(soc,0)}%`:charging?'Laden':'Niet laden';
  const cSub=charging?`${ehPower(ev)} laadvermogen`:(soc!==null?'Accuniveau uit Cupra':'Geen laadvermogen gemeten');
  const batteryText=battery!==null?`${ehFmt(battery,0)}%`:'—';
  const batterySub=battery!==null?'Virtuele balans':'Sensor nog niet gekoppeld';
  const colorNet=net!==null&&net< -50?'mint':'blue';
  const weatherBadge=weather?`<div class="weather"><span>${ehIcon('sun')}</span><strong>${ehEsc(weather.attributes?.temperature??'—')}°</strong><small>${ehEsc(weather.state)}</small></div>`:
   '';
  const hero=ehValidHero(c.hero_image)?c.hero_image:EH_HERO_DATA;
  const legend=`<div class="legend"><span><i class="dot sun-dot"></i>Zon</span><span><i class="dot house-dot"></i>Huis</span><span><i class="dot grid-dot"></i>Net</span><span><i class="dot ev-dot"></i>Auto</span></div>`;
  const ids=[c.zonnepanelen,c.huis,c.net,c.laden];
  const day=ehDayKey(new Date());
  const plotted=this._historyKey.startsWith(day+'|')?this._history:null;
  const selectedIndex=plotted?.samples?.length?ehClosestIndex(plotted.samples,this._selectedAt):0;
  const graph=this._historyError?`<div class="no-chart">Historische gegevens niet beschikbaar. Controleer de History-integratie en toegang tot deze entiteiten.</div>`:ehChart(plotted,ids,selectedIndex);
  const tab=(name,icon)=>{
    const pages={Overzicht:'overview',Cupra:'cupra','Cupra & Slim laden':'charge',Batterij:'battery',Kosten:'costs',Meer:'more'};
    const page=pages[name],current=this._view===page;
    const label=name==='Cupra & Slim laden'?'<span class="nav-label-full">Cupra &amp; Slim laden</span><span class="nav-label-short">Slim laden</span>':`<span>${ehEsc(name)}</span>`;
     return `<button class="navitem ${current?'active':''}" data-eh-page="${page}" aria-label="${ehEsc(name)}" ${current?'aria-current="page"':''} type="button">${ehIcon(icon)}${label}</button>`;
  };
  const missing=[['P1',net],['GoodWe',pv],['Alfen',ev],['Zonneplan',price],['Huis',house]].filter(([,v])=>v===null).map(([name])=>name);
  this.shadowRoot.innerHTML=`<style>
:host{display:block;width:100%;font-family:var(--primary-font-family,inherit);--base:#071522;--card:#14273b;--edge:#35516a;--muted:#a5bdcf;--text:#eef7ff;--mint:#38e8a1;--gold:#ffca44;--blue:#61b7ff}
*{box-sizing:border-box}.shell{overflow:visible;color:var(--text);background:linear-gradient(152deg,#081827 0%,#05121d 100%);border-radius:23px;box-shadow:0 16px 45px #0002;max-width:1300px;margin:auto;border:1px solid #ffffff13}
.hero{border-radius:22px 22px 0 0;position:relative;height:260px;background:#0c2035 center/cover no-repeat;isolation:isolate}
.hero:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,#071624eb 0%,#0b24382b 46%,#091a2e11 72%,#071522 100%);z-index:-1}
.hero-inner{padding:25px 25px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.title{font-size:35px;font-weight:850;line-height:1.05;letter-spacing:-1.2px;margin:0;text-shadow:0 2px 15px #0008}
.subtitle{font-size:13px;color:#d7e4f0;margin-top:8px;text-shadow:0 2px 9px #000a}
.read-only{align-self:start;display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;white-space:nowrap;padding:9px 10px;border-radius:99px;background:#122c3bdf;border:1px solid #a4d2d33f;color:#a9f0dc}
.read-only .icon{width:14px;height:14px}.weather{border-radius:16px;background:#122c40dd;border:1px solid #bbd9e737;padding:7px 12px;display:grid;grid-template-columns:28px auto;align-items:center;gap:2px 5px}.weather .icon{color:var(--gold)}.weather strong{font-size:18px}.weather small{grid-column:1/-1;text-align:right;color:#cbd9e7;font-size:11px}
.body{padding:0 20px 15px;margin-top:-23px;position:relative;z-index:1}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.metric{appearance:none;color:inherit;font:inherit;text-align:left;width:100%;cursor:pointer;position:relative;display:flex;align-items:center;gap:14px;min-width:0;padding:16px 14px;border-radius:18px;background:linear-gradient(145deg,#1a3145ed,#0c2031f5);box-shadow:0 5px 16px #0004;border:1px solid #8fb3ca2d;min-height:105px}
.metric:focus-visible{outline:2px solid #70c7f8;outline-offset:2px}.metric[aria-expanded="true"]{border-color:#36dca7a6;background:linear-gradient(145deg,#163849,#0c2331)}.metric-chevron{align-self:center;margin-left:auto;color:#86a6ba;opacity:.7}.metric-chevron .icon{width:15px;height:15px}.metric-symbol{flex:none;width:45px;height:45px;display:grid;place-items:center}.metric-symbol .icon{height:36px;width:36px;stroke-width:1.9}
.shell .cupra-price-slot,.shell .cupra-price-bars.is-quarter .cupra-price-slot{min-width:0;flex:1 1 0}.metric-copy{min-width:0}.metric-label{font-size:12px;line-height:1.3;color:#d2e0ec}.metric-value{font-size:24px;line-height:1.18;font-weight:800;letter-spacing:-.6px;margin-top:8px;overflow-wrap:anywhere}.metric-sub{font-size:11px;line-height:1.35;color:#aac3d4;margin-top:5px}
.mint{color:var(--mint)}.gold{color:var(--gold)}.blue{color:var(--blue)}.peach{color:#ffae83}.white{color:#f6f9ff}
.metric-euro .metric-value{font-size:23px}.metric-gas .metric-symbol{color:#ff9b6b}.metric-water .metric-symbol{color:#67c8ff}
.subpage{padding:22px 20px 88px;min-height:620px}.subpage-head{display:flex;align-items:flex-start;justify-content:space-between;gap:22px;margin:3px 0 19px;padding:16px 4px}.subpage-head h2{margin:2px 0 7px;font-size:32px;letter-spacing:-.8px}.subpage-head p{margin:0;color:#a9c3d5;font-size:13px;line-height:1.5;max-width:670px}.eyebrow{text-transform:uppercase;letter-spacing:.12em;color:#61dcb0;font-weight:800;font-size:10px}.subgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.subgrid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.subcard,.subsection,.utility-card{border:1px solid #83adc42f;background:linear-gradient(145deg,#173047,#0b2132);border-radius:18px;box-shadow:0 6px 18px #0003}.subcard{padding:15px;min-height:132px;display:flex;flex-direction:column;align-items:flex-start}.subcard small{color:#a8c2d3;margin-top:10px}.subcard strong{font-size:24px;margin-top:5px;letter-spacing:-.4px}.subcard span{font-size:10px;color:#87a8bb;margin-top:5px}.sub-icon{width:39px;height:39px;border-radius:13px;display:grid;place-items:center;background:#14364b}.sub-icon .icon{width:24px;height:24px}.sub-icon.mint{color:var(--mint);background:#28d99a18}.sub-icon.blue{color:var(--blue);background:#4ca6ff18}.sub-icon.gold{color:var(--gold);background:#ffc93a18}.sub-icon.peach{color:#ff9e76;background:#ff9e7618}.subsection{padding:17px;margin-top:12px}.subrows{display:grid;margin-top:7px}.subrows>div{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 2px;border-bottom:1px solid #9db9cb20;font-size:13px}.subrows>div:last-child{border-bottom:0}.subrows span{color:#aac2d2}.subrows strong{font-size:14px;text-align:right}.positive{color:var(--mint)!important}.negative{color:#ff9e76!important}.cost-trend{overflow:hidden}.cost-periods{display:flex;gap:7px;margin:11px 0 8px}.cost-periods button{appearance:none;border:1px solid #6d99b53d;background:#0b2132;color:#a9c5d6;border-radius:999px;padding:7px 12px;font:inherit;font-size:11px;font-weight:750;cursor:pointer}.cost-periods button.chosen{background:#153c50;border-color:#55d7b66b;color:#eafaff}.cost-compare-chart{display:block;width:100%;height:auto;margin:10px 0 4px;touch-action:pan-y;user-select:none;-webkit-user-select:none}.cost-compare-readout{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:center;margin-top:7px;padding:10px 11px;border:1px solid #7aa5bc2e;background:#081c2a;border-radius:12px;font-size:11px}.cost-compare-readout span{color:#99b8ca}.cost-compare-readout strong{text-align:right;font-size:12px}.soc-ring{flex:none;width:112px;height:112px;border-radius:50%;border:9px solid #2ccf9860;box-shadow:inset 0 0 0 1px #74e0bd40;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0c2232}.soc-ring strong{font-size:25px}.soc-ring span{font-size:10px;color:#9fc0d0;margin-top:4px}.price-badge{min-width:130px;border:1px solid #5ba1c847;background:#0d2638;border-radius:16px;padding:12px 15px;text-align:right}.price-badge small,.price-badge span{display:block;color:#9ab8cb;font-size:10px}.price-badge strong{display:block;font-size:22px;margin:3px 0}.utility-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.utility-card{padding:17px}.utility-head{display:flex;align-items:center;gap:13px}.utility-head small{display:block;color:#9ebccc}.utility-head strong{display:block;font-size:24px;margin-top:3px}
.chart-panel{margin-top:14px;padding:17px 17px 12px;background:linear-gradient(150deg,#12273bea,#0b1f31);border:1px solid #9dbbd02b;border-radius:20px}
.chart-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.chart-title{font-size:17px;font-weight:750;letter-spacing:-.3px;display:flex;align-items:center;gap:7px}.chart-title .icon{width:16px;height:16px;color:#9bb4cc}.now-power{font-size:15px;font-weight:800;color:var(--gold);white-space:nowrap}
.chart-note{font-size:11px;color:#9dbbd1;margin-top:4px}.history{display:block;width:100%;height:auto;margin:9px auto 0;overflow:visible}.gridline{stroke:#b1cddd20;stroke-width:1}.xlab,.ylab{fill:#a4bfd2;font-size:13px}
.legend{display:flex;gap:22px;justify-content:center;align-items:center;color:#ccdae7;font-size:12px;margin:3px 0 0}.legend span{display:flex;gap:7px;align-items:center}.dot{width:10px;height:10px;border-radius:50%;display:inline-block}.sun-dot{background:#f6c33a}.house-dot{background:#449ef8}.grid-dot{background:#3de49b}

.history{touch-action:pan-y;user-select:none;-webkit-user-select:none}
.timeline{display:block;width:100%;height:24px;margin:1px 0 0;accent-color:var(--mint);cursor:pointer}
.reading{background:#051624bb;border:1px solid #7297ae33;border-radius:14px;padding:11px 12px;margin:5px 0 10px}
.reading-head{display:flex;align-items:baseline;gap:11px;justify-content:space-between;margin-bottom:11px}.reading-head strong{font-size:16px;color:var(--text)}.reading-head span{font-size:10px;color:#9fb9cf;text-align:right}
.reading-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
.reading-item{min-width:0;display:flex;flex-direction:column;gap:6px}.reading-item>span{font-size:10px;color:#bed1dc;display:flex;align-items:center;gap:4px}.reading-item strong{font-size:13px;white-space:nowrap;font-variant-numeric:tabular-nums}
.ev-dot{background:#a98aff}
.detail-panel{margin:12px 0 0;border:1px solid #39d5a65a;background:linear-gradient(140deg,#142f42,#092235);border-radius:18px;padding:15px;box-shadow:0 4px 17px #0003}
.detail-top{display:flex;justify-content:space-between;gap:14px;align-items:center}.detail-title{display:flex;gap:10px;align-items:center;font-size:15px}.detail-title .icon{color:var(--mint)}.detail-close{font-size:24px;line-height:1;width:32px;height:32px;border-radius:10px;border:1px solid #6c92a55a;color:#ecf7ff;background:#203b4d;cursor:pointer}
.detail-value{font-size:26px;font-weight:800;margin:8px 0}.detail-muted{color:#b9cedb;font-size:12px;line-height:1.5;margin:6px 0 10px}.detail-source{font-size:10px;color:#779eb7;margin-top:12px;word-break:break-word}
.detail-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.detail-stats>div{border:1px solid #9ec2d62b;border-radius:12px;padding:9px 10px;color:#b0cede;font-size:11px;display:flex;flex-direction:column;gap:5px}.detail-stats strong{font-size:16px;color:#eef9ff}
.detail-small-title{font-size:12px;font-weight:700;margin:12px 0 7px}.price-bars{height:112px;display:flex;align-items:stretch;gap:3px;padding:5px 0}.price-hour{appearance:none;border:0;border-radius:5px 5px 1px 1px;background:#193549;cursor:pointer;flex:1;min-width:0;display:flex;align-items:flex-end;padding:0 1px;outline-offset:2px}.price-hour>span{display:block;width:100%;background:#5f9bd1;border-radius:3px 3px 0 0}.price-hour.cheap>span{background:#3de49b}.price-hour.chosen{outline:2px solid #f4f9ff}.price-inspect{display:flex;justify-content:space-between;gap:12px;font-size:13px;margin:8px 0}
.no-chart{min-height:180px;display:flex;align-items:center;justify-content:center;gap:10px;text-align:center;font-size:12px;color:#b2cddd;line-height:1.6;padding:22px}.no-chart .icon{color:#67b5ed;flex:none}
.foot{margin:12px 2px 0;font-size:10px;color:#809eaf;text-align:center;line-height:1.5}.notice{border-left:3px solid #ffd16e;background:#ffdc7211;color:#ffe0aa;border-radius:6px;padding:8px 10px;font-size:11px;margin-top:12px}
.nav{position:sticky;bottom:0;border-radius:0 0 21px 21px;z-index:50;box-shadow:0 -10px 25px #020b15bb;display:flex;align-items:stretch;justify-content:space-around;background:#06131f;border-top:1px solid #9bd0d021;padding:10px 5px max(12px,env(safe-area-inset-bottom));gap:3px}
.navitem{appearance:none;border:0;background:transparent;color:#91a9bb;display:flex;gap:5px;flex-direction:column;align-items:center;justify-content:center;padding:6px 4px;min-width:0;flex:1;font:inherit;font-size:11px;cursor:pointer;border-radius:12px}
.navitem .icon{width:21px;height:21px}.nav-label-short{display:none}.nav-label-full{display:inline}.navitem.active{color:var(--mint);background:#1adb9220;font-weight:750}.navitem:disabled{opacity:.48;cursor:not-allowed}.navitem:not(:disabled):focus-visible{outline:2px solid #76c1ef;outline-offset:1px}

/* Tweede scherm: Cupra Born. Bestaande overview styling blijft onaangetast. */
.cupra-page{padding:20px 20px 16px;display:flex;flex-direction:column;gap:12px}
.cupra-head{display:flex;align-items:center;gap:12px;margin-bottom:4px;min-width:0}
.cupra-head h2{font-size:25px;letter-spacing:-.6px;line-height:1.12;margin:4px 0 0;font-weight:800}
.cupra-kicker{font-size:10px;letter-spacing:1.6px;color:#74cdb8;font-weight:750}
.back-button{border:1px solid #7a9eaf55;color:#eaf5ff;background:#193346;border-radius:12px;width:40px;height:42px;flex:none;font-size:25px;cursor:pointer}
.cupra-head .compact{font-size:10px;margin-left:auto;padding:7px 9px}
.cupra-hero{position:relative;min-height:205px;background:radial-gradient(ellipse at 75% 10%,#17496a,#10283a 56%,#09202c);border:1px solid #94bdd33b;border-radius:22px;padding:24px;display:flex;align-items:center;justify-content:space-between;overflow:hidden}
.cupra-car-icon{color:#67bcff;opacity:.7;flex:none}.cupra-car-icon .icon{width:130px;height:130px;stroke-width:1.1;filter:drop-shadow(0 0 13px #158bd7a0)}
.cupra-photo{position:absolute;inset:0;background-position:center;background-size:cover;opacity:.72}
.cupra-car-copy{position:relative;z-index:1;margin-left:auto;text-align:right;text-shadow:0 1px 9px #001a28}
.cupra-name{font-size:18px;font-weight:750}.cupra-connection{font-size:12px;color:#a8d4dc;margin-top:7px}
.cupra-big{font-size:37px;font-weight:850;letter-spacing:-1px;margin-top:8px}.cupra-big span{font-size:13px;color:#a4c2d2;letter-spacing:0}
.cupra-small{font-size:12px;color:#c4d8e4;margin-top:3px}
.vehicle-status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.vehicle-status{border:1px solid #82abc52d;border-radius:15px;background:#0b2132;padding:12px;min-width:0;display:flex;flex-direction:column;gap:4px}.vehicle-status-icon{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:#102c40;margin-bottom:4px}.vehicle-status-icon .icon{width:20px;height:20px}.vehicle-status small{font-size:10px;color:#9db9cb}.vehicle-status strong{font-size:18px;overflow-wrap:anywhere}.vehicle-status em{font-size:9px;color:#7699ae;font-style:normal;line-height:1.3}.vehicle-details-toggle{appearance:none;width:100%;margin-top:10px;border:1px solid #66b7d94a;border-radius:13px;background:#102a3d;color:#dff5ff;padding:11px 13px;font:inherit;font-size:12px;font-weight:750;display:flex;justify-content:space-between;align-items:center;cursor:pointer}.vehicle-details{display:none;margin-top:10px;border-top:1px solid #82a7bd25;padding-top:12px}.vehicle-details.open{display:block}.vehicle-detail-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:4px}.vehicle-detail-grid>div{background:#081b2a;border:1px solid #80a5bc26;border-radius:12px;padding:10px;min-width:0}.vehicle-detail-grid span{display:block;color:#8faec1;font-size:9px}.vehicle-detail-grid strong{display:block;margin-top:5px;font-size:12px;overflow-wrap:anywhere}
.cupra-insights{overflow:hidden}.insight-periods{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0 13px}.insight-periods button{appearance:none;border:1px solid #6d99b53d;background:#0b2132;color:#a9c5d6;border-radius:999px;padding:7px 11px;font:inherit;font-size:10px;font-weight:750;cursor:pointer}.insight-periods button.chosen{background:#153c50;border-color:#55d7b66b;color:#eafff8}.km-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:11px 0}.km-summary>div,.insight-metrics>div{background:#081d2c;border:1px solid #7da5bc2b;border-radius:13px;padding:10px;min-width:0}.km-summary small,.insight-metrics small{display:block;color:#8fadc0;font-size:9px}.km-summary strong{display:block;font-size:17px;margin-top:5px;white-space:nowrap}.insight-headline{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:13px 0 7px;padding:12px 13px;background:linear-gradient(135deg,#0b2637,#102e3f);border:1px solid #70a4be32;border-radius:14px}.insight-headline>div:first-child{display:flex;flex-direction:column;gap:3px}.insight-headline small{color:#92b2c5;font-size:9px}.insight-headline strong{font-size:24px}.insight-headline span{color:#a7c4d4;font-size:10px}.quality-pill{min-width:88px;text-align:center;border-radius:11px;padding:8px 10px;border:1px solid #789db13d;background:#102636}.quality-pill small{display:block;font-size:8px;color:#91adbe}.quality-pill strong{display:block;margin-top:4px;font-size:12px}.quality-pill.sterk{border-color:#42dca072;background:#0d3a2f}.quality-pill.opbouwend{border-color:#e2b75c69;background:#3c3114}.quality-pill.beperkt{border-color:#e8916a5c;background:#382319}.cupra-km-chart,.cupra-temp-chart{display:block;width:100%;height:auto;margin:7px 0 3px}.temp-trend-panel{margin-top:10px}.insight-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.insight-metrics strong{display:block;font-size:16px;margin-top:5px;overflow-wrap:anywhere}.insight-metrics span{display:block;color:#789aad;font-size:9px;line-height:1.35;margin-top:5px}.insight-split{display:grid;grid-template-columns:1.25fr 1fr;gap:10px;margin-top:10px}.insight-panel{background:#071b29;border:1px solid #759bb12a;border-radius:14px;padding:12px;min-width:0}.temp-row{display:grid;grid-template-columns:82px minmax(60px,1fr) 130px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #7194a61c}.temp-row:last-of-type{border-bottom:0}.temp-copy,.temp-values{display:flex;flex-direction:column;gap:3px}.temp-copy strong,.temp-values strong{font-size:11px}.temp-copy span,.temp-values span{font-size:8px;color:#819fb1;line-height:1.3}.temp-values{text-align:right}.temp-bar{height:8px;background:#153043;border-radius:999px;overflow:hidden}.temp-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#4ca4e7,#52e0ad)}.climate-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.climate-grid>div{background:#0b2636;border:1px solid #7193a42b;border-radius:10px;padding:9px;min-width:0}.climate-grid span{display:block;color:#87a8ba;font-size:8px;line-height:1.3}.climate-grid strong{display:block;margin-top:5px;font-size:13px}.correlation-row{display:flex;justify-content:space-between;gap:10px;border-top:1px solid #769aac20;padding:9px 1px 0;margin-top:9px;font-size:9px;color:#91afc0}.correlation-row strong{color:#d9edf7;text-align:right}.insight-quality{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.insight-quality span{font-size:9px;color:#8faec0;background:#0b2232;border:1px solid #7395a82a;border-radius:999px;padding:6px 8px}.insight-quality strong{color:#e7f7ff}.cupra-card{border:1px solid #a0bfd336;background:linear-gradient(148deg,#142d42,#0d2234);border-radius:20px;padding:17px}
.cupra-card .section-label{font-size:13px;color:#dbe9f2;font-weight:750;margin-bottom:10px}
.charge-row{display:flex;justify-content:space-between;gap:12px;align-items:center}
.charge-power{font-size:30px;font-weight:820}.charge-row p{font-size:12px;color:#b5d0de;margin:3px 0 0}.charge-amps{text-align:right;display:grid;gap:6px;color:#a9c7d6;font-size:11px}.charge-amps strong{font-size:17px;color:#f4fbff}
.charge-progress{background:#28455b;height:9px;border-radius:20px;margin:16px 0 8px;overflow:hidden}.charge-progress>div{height:100%;border-radius:20px;background:linear-gradient(90deg,#129b74,#47e6a4)}
.subtle{color:#abc5d5;font-size:11px;line-height:1.5;margin:9px 0 0}
.section-title{display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;margin-bottom:14px}.section-title .icon{color:#59ddab;width:19px;height:19px}.section-title .only-sim{margin-left:auto;font-size:10px;color:#ffda85;background:#ba7f1822;border:1px solid #ba8f4066;padding:5px 6px;border-radius:7px;font-weight:650}
.planning-inputs{display:flex;flex-direction:column;gap:14px}.plan-input{display:flex;flex-direction:column;gap:7px;font-size:11px;color:#cddfea;min-width:0}.plan-input span{display:flex;justify-content:space-between;align-items:center}.plan-input span b{color:#52e6af;font-size:15px}.plan-input small{color:#9db7c8;font-size:10px}.plan-input>input:not([type=range]){appearance:auto;color-scheme:dark;background:#0b2030;border:1px solid #91bcd252;border-radius:10px;padding:10px 10px;color:#f2fbff;width:100%;font:inherit;font-size:14px;min-width:0}.plan-input>input[type=range]{width:100%;accent-color:#50eaa9}
.plan-input-row{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.mode-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.mode{color:#b7ccda;background:#0d2131;border:1px solid #829db645;border-radius:13px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 3px;text-align:center;cursor:pointer;min-width:0}.mode .icon{width:23px;height:23px;color:#94c3ee}.mode strong{font-size:12px}.mode span{font-size:9px;line-height:1.3}.mode.active{border-color:#38dfa3;background:linear-gradient(145deg,#0d5946,#0b332d);color:#f0fff8}.mode.active .icon{color:#3df0a8}.mode:disabled{opacity:.4;cursor:not-allowed}
.cupra-price-bars{overflow-x:auto;display:flex;gap:3px;align-items:end;height:95px;margin-top:14px;border-bottom:1px solid #aacbde66;padding-top:8px}.cupra-price-slot{flex:1;min-width:4px;height:100%;display:flex;align-items:end;appearance:none;border:0;background:transparent;padding:0;cursor:pointer}.cupra-price-bars.is-quarter .cupra-price-slot{min-width:5px}.cupra-price-slot.inspected{outline:2px solid #ffe09b;outline-offset:2px;border-radius:3px}.cupra-price-fill{display:block;background:#5a99cd;border-radius:4px 4px 0 0;min-height:3px;width:100%}.cupra-price-fill.selected{background:#3ee5a5}.cupra-price-axis{display:flex;justify-content:space-between;color:#9cbed3;font-size:10px;margin:6px 0 13px}
.cupra-price-timeline{display:block;width:100%;margin:7px 0 4px;accent-color:#4ce6ad}.cupra-price-compare{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:12px 0}.cupra-price-compare>div{display:flex;flex-direction:column;gap:6px;border:1px solid #8ab7ce33;border-radius:10px;background:#092334;padding:10px 6px;min-width:0}.cupra-price-compare small{font-size:10px;color:#a9c5d7}.cupra-price-compare strong{font-size:17px;color:#e7f8ff}.cupra-price-compare span{font-size:10px;color:#5de5b3}.cupra-price-inspect{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:9px 3px;font-size:11px;color:#d9ebf5}.plan-results{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0 12px}.plan-results>div{border-radius:12px;border:1px solid #aec6d52c;padding:10px 7px;display:flex;flex-direction:column;gap:8px;min-width:0}.plan-results span{font-size:10px;color:#9fbaca}.plan-results strong{font-size:16px;overflow-wrap:anywhere}.plan-results strong.gold{color:#ffca44}
.scheduled-hours{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px}.scheduled-hour{background:#071d2d;border-radius:9px;border:1px solid #a2bfd52b;padding:8px;font-size:11px;display:grid;gap:5px;min-width:0}.scheduled-hour span{color:#c8dceb}.scheduled-hour strong{font-size:10px;color:#47e5ae}
.plan-warning{color:#ffda91;font-size:11px;padding:10px;background:#ad7a1620;border-left:3px solid #edbd59;line-height:1.4;border-radius:6px}
.cupra-safety{background:#12403833;border:1px solid #39b88f55;border-radius:13px;padding:12px;display:flex;gap:10px;align-items:start;color:#b5dacf;font-size:11px;line-height:1.5}.cupra-safety .icon{flex:none;width:19px;height:19px;color:#4fdaac}
@media(max-width:760px){.navitem{padding:6px 1px}.nav-label-full{display:none}.nav-label-short{display:inline}.hero{height:230px}.hero-inner{padding:21px 16px 0}.title{font-size:29px}.subtitle{font-size:11px}.body{padding:0 12px 12px;margin-top:-17px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.metric{padding:11px 9px;min-height:106px;gap:8px;border-radius:15px}.metric-symbol{width:31px;height:35px}.metric-symbol .icon{width:29px;height:29px}.metric-label{font-size:11px}.metric-value{font-size:19px;letter-spacing:-.5px;margin-top:7px}.metric-euro .metric-value{font-size:19px}.metric-sub{font-size:10px}.chart-panel{margin-top:10px;padding:14px 9px 12px;border-radius:17px}.chart-title{font-size:15px}.now-power{font-size:14px}.legend{font-size:11px;gap:12px}.navitem{font-size:10px}.navitem .icon{width:20px;height:20px}}
@media(max-width:760px){.cupra-page{padding:16px 11px}.cupra-head{gap:8px}.cupra-head h2{font-size:18px}.cupra-head .compact{font-size:9px;padding:6px 6px}.cupra-hero{min-height:180px;padding:16px}.cupra-car-icon .icon{width:95px;height:95px}.cupra-card{padding:13px}.scheduled-hours{grid-template-columns:1fr 1fr}.plan-results strong{font-size:14px}.vehicle-status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.vehicle-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:380px){.hero{height:210px}.title{font-size:27px}.subtitle{max-width:200px;line-height:1.35}.metric{gap:5px;padding:10px 7px}.metric-symbol{width:27px}.metric-symbol .icon{width:25px;height:25px}.metric-value,.metric-euro .metric-value{font-size:17px}.reading-item strong{font-size:11px}.reading-grid{gap:3px}.metric-chevron .icon{width:12px;height:12px}.read-only{font-size:10px;padding:8px 7px}.chart-title{font-size:14px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}

/* Uitklapbare historische energieanalyse */
.energy-detail{margin-top:13px}
.energy-periods{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0}
.energy-period{font:inherit;font-size:11px;font-weight:650;padding:9px 10px;border-radius:10px;border:1px solid #83aec342;background:#0b2639;color:#b9d3e6;cursor:pointer}
.energy-period.chosen{border-color:#4cddb1;background:#164d44;color:#e7fff8}
.energy-period:focus-visible{outline:2px solid #83d7f3}
.energy-period-label{font-size:11px;color:#adcedc;margin:5px 0 10px}
.energy-totals{display:flex;flex-wrap:wrap;gap:10px;margin:9px 0 12px}
.energy-totals>div{background:#0b2638;border:1px solid #80abc62b;border-radius:12px;padding:12px 15px;display:flex;gap:7px;flex-direction:column;flex:1;min-width:110px}
.energy-totals small{color:#aac6d9;font-size:11px}.energy-totals strong{font-size:20px;color:#eaf9ff}
.energy-compare{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:12px;margin:7px 0 14px;color:#b8d9e4}.energy-compare strong{color:#f2f7ff}.energy-compare span:last-child{color:#4ae4b6}
.metric-history{display:block;width:100%;height:auto;margin:8px 0;touch-action:pan-y;user-select:none}
.energy-loading{display:flex;align-items:center;justify-content:center;min-height:115px;color:#b2d7e4;font-size:12px}
.energy-point-readout{font-size:12px;border-radius:11px;background:#0c2c3e;padding:11px 12px;color:#ecf7ff;min-height:40px;line-height:1.5}
.energy-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:11px;color:#b8d1df;margin:12px 0}
.energy-legend>span{display:flex;align-items:center;gap:6px}.energy-legend i{display:inline-block;width:9px;height:9px;border-radius:50%}
@media(max-width:760px){.energy-periods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.energy-period{font-size:10px;padding:8px 4px}.energy-totals strong{font-size:17px}.energy-detail{padding:12px 9px}}
@media(max-width:720px){.subpage{padding:13px 10px 82px}.subpage-head{padding:10px 2px;align-items:center}.subpage-head h2{font-size:27px}.subpage-head p{font-size:11px}.subgrid,.subgrid.three{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.subcard{min-height:118px;padding:13px}.subcard strong{font-size:20px}.soc-ring{width:88px;height:88px;border-width:7px}.soc-ring strong{font-size:20px}.price-badge{min-width:110px;padding:10px}.utility-grid{grid-template-columns:1fr}.utility-head strong{font-size:21px}.cost-compare-readout{grid-template-columns:1fr 1fr}.cost-compare-readout span{grid-column:1/-1}.cost-compare-readout strong{text-align:left}.km-summary,.insight-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.insight-split{grid-template-columns:1fr}.temp-row{grid-template-columns:72px minmax(45px,1fr) 116px}.insight-headline strong{font-size:21px}.quality-pill{min-width:78px}.climate-grid{grid-template-columns:1fr 1fr}}

/* Mobile visual review: presentation only. */
:host{--eh-zon:#f6c33a;--eh-huis:#449ef8;--eh-net:#3de49b;--eh-auto:#a98aff}
.shell{min-width:0}.shell main,.shell section,.shell details,.shell fieldset{min-width:0}
.shell>.eh19-appbar {display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:#071e2d;border-radius:20px 20px 0 0}
.eh19-appname small{font-size:10px;letter-spacing:.1em;color:#74dfb1}.eh19-connection{font-size:10px;padding:6px 9px;border:1px solid #648b9b66;border-radius:999px;color:#c4dfeb}.eh19-density{min-height:40px;background:#183a4c;color:#effbff;border:1px solid #648b9b;border-radius:9px;font:inherit;font-size:11px;padding:8px;cursor:pointer}
.shell.eh19-roomy .hero,.shell:not(.eh19-roomy) section.hero{height:84px!important;border-radius:0}.shell .hero-inner,.shell:not(.eh19-roomy) .hero-inner{padding:17px 13px}.shell .title{font-size:26px}.shell .subtitle{display:none}
.shell .body,.shell:not(.eh19-roomy) .body{margin-top:0}.shell .metrics .metric .metric-sub{display:block;font-size:10px;line-height:1.4;margin-top:4px;white-space:normal}
.metric-grid .metric-symbol,.metric-grid .metric-value{color:var(--eh-net)}.metric-sun .metric-symbol,.metric-sun .metric-value{color:var(--eh-zon)}.metric-home .metric-symbol,.metric-home .metric-value{color:var(--eh-huis)}.metric-car .metric-symbol,.metric-car .metric-value{color:var(--eh-auto)}
.shell .legend{flex-wrap:wrap;gap:10px 15px}.shell .cupra-head{margin:0}.cupra-kicker,.eyebrow{display:none}.shell .cupra-head h2,.shell .subpage-head h2{font-size:24px}.shell .cupra-hero,.shell:not(.eh19-roomy) .cupra-hero{min-height:112px;padding:12px}.cupra-car-icon .icon{width:75px;height:75px}.cupra-big{font-size:30px}.cupra-name{display:none}
.charge-page>.cupra-head{order:-3}.charge-page>.eh17-panel{order:-2;margin-top:0}.charge-page>.eh20-control {order:0}
.charge-page .eh17-title{font-size:15px}.charge-page .eh17-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.charge-page .eh17-option{min-width:0;padding:10px 7px}.charge-page .eh17-option strong{font-size:19px}.charge-page .eh17-option small,.charge-page .eh17-option span,.charge-page .eh17-option em{font-size:10px;line-height:1.4;overflow-wrap:anywhere}.charge-page .eh17-good{font-size:12px;padding:8px 0;margin:0}
.eh32-model,.eh32-hours,.eh32-feasibility{margin:10px 0;font-size:12px;color:#bcd6e3}.eh32-model summary,.eh32-hours summary,.eh32-feasibility summary,.eh30-evidence>summary{cursor:pointer;min-height:36px;line-height:1.5;padding:8px 0;font-weight:650}.eh32-model p{font-size:11px;line-height:1.5}
.charge-page .planning-inputs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.planning-inputs>*,.plan-input-row>*,.plan-input{min-width:0}.planning-inputs .plan-input-row{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.plan-input input{width:100%;min-width:0;max-width:100%;box-sizing:border-box}.plan-input input[type=datetime-local]{display:block;appearance:none;-webkit-appearance:none;width:100%;font-size:14px;padding:10px 6px;min-height:42px}.plan-input span{flex-wrap:wrap}.plan-input small{display:none}
.eh32-quality{position:relative}.eh32-coverage{position:absolute;right:10px;top:12px;pointer-events:none;font-size:10px;color:#bbd5df}.eh32-quality .eh30-evidence>summary{padding-right:155px}.eh30-evidence{margin:8px 0;padding:0 10px;border:1px solid #638c9d55;border-radius:10px;color:#bbd5df}.eh30-evidence>summary{font-size:11px}.eh30-evidence h4{font-size:13px}.eh26-overview{margin-top:0}.eh32-feasibility .eh18-kpi{display:none}.eh31-season text,.eh23-flow-svg text,.eh26-forecast-svg text{paint-order:stroke;stroke:#092637;stroke-width:3px;stroke-linejoin:round}
.eh23-legacy-content .subpage-head{display:none}.eh20-panel>h3{display:none}.subgrid.three{grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}.shell .cupra-price-slot,.shell .cupra-price-bars.is-quarter .cupra-price-slot{min-width:0;flex:1 1 0}.metric-copy{min-width:0}.metric-value{overflow-wrap:anywhere}.shell .metric-euro .metric-value{font-size:16px;white-space:nowrap}.ehcmp h3,.ehcat h3{font-size:17px;margin:0}
@media(max-width:720px){.shell .metrics>.metric:last-child:nth-child(odd),.body>.eh17-panel .eh17-grid>div:last-child:nth-child(odd){grid-column:1/-1}.shell .eh26-tabs{grid-template-columns:repeat(4,minmax(0,1fr))}.shell .eh26-tabs button{font-size:10px;padding:6px 3px}.shell .eh19-appbar .eh19-connection{display:inline-block;max-width:130px;font-size:9px}.shell .eh19-density{font-size:10px}.shell .hero{height:76px}.shell .title{font-size:24px}.shell .cupra-head,.shell .subpage-head{padding:2px 0}.shell .cupra-page,.shell .subpage{padding-top:10px}.shell .subpage-head p{display:none}.eh26-overview{grid-template-columns:repeat(3,minmax(0,1fr))}.eh26-overview strong{font-size:16px}.planning-inputs>label{grid-column:1/-1}.shell .cupra-safety{font-size:10px;line-height:1.5}.shell .eh17-option{border-radius:10px}.shell .eh17-option strong{font-size:17px}.charge-page .eh17-panel>.cupra-safety{display:none}}

.eh23-power-suggestions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:12px 0 0}.eh23-power-suggestions>p{grid-column:1/-1;margin:0}.eh23-power-choice{font:inherit;font-size:12px;text-align:left;min-width:0;min-height:44px;padding:11px;border:1px solid #7295aa;border-radius:10px;color:#e5f5fc;background:#123449;cursor:pointer;display:flex;flex-direction:column;gap:6px}.eh23-power-choice.is-selected{border-color:#49cfa5;background:#124638;box-shadow:inset 0 0 0 1px #49cfa5}.eh23-power-choice:disabled{opacity:.5;cursor:not-allowed}.eh23-power-choice:focus-visible{outline:2px solid white;outline-offset:2px}.eh23-power-choice strong{font-size:16px;overflow-wrap:anywhere}.eh23-power-choice small{font-size:10px;line-height:1.5;color:#c7dfe7}.eh23-window-note{font-size:10px;color:#b0cedb;line-height:1.5;margin:8px 0}.charge-page .eh20-actions{display:flex;gap:10px;flex-wrap:wrap}.charge-page .eh20-actions button{min-height:44px;min-width:90px}.charge-page .eh20-state{display:inline-flex;align-items:center;border:1px solid #8fbbba80;border-radius:999px;padding:5px 8px;font-size:10px}.charge-page .eh20-control .section-title{flex-wrap:wrap;gap:8px}
@media(max-width:360px){.eh23-power-suggestions{grid-template-columns:1fr}}
</style>
<article class="shell" aria-label="Energiehuis energiedashboard">
 ${this._view==='cupra'||this._view==='charge'?this._cupraHtml(h,c):this._view==='battery'?this._batteryHtml(h,c):this._view==='costs'?this._costsHtml(h,c):this._view==='more'?this._moreHtml(h,c):`
 <section class="hero" style="background-image:linear-gradient(180deg,#06152477,#07152415 58%,#071522 100%),url('${ehEsc(hero)}')">
  <div class="hero-inner"><div><h2 class="title">Overzicht</h2><div class="subtitle">Slimmer energie. Een duurzamer thuis.</div></div>${weatherBadge}</div>
 </section>
 <main class="body"><div class="metrics">
  ${iconCard('grid','Netvermogen',ehPower(net),netLabel,colorNet)}
  ${iconCard('sun','Zonnepanelen',ehPower(pv),'Huidige productie','gold')}
  ${iconCard('home','Verbruik huis',ehPower(house),'Exclusief Cupra','peach')}
  ${iconCard('euro','Stroomprijs',price===null?'—':ehMoney(price)+'/kWh',price===null?'Tarief niet beschikbaar':'Tarief nu','blue')}
  ${iconCard('car','Cupra Born',cSoc,cSub,charging?'mint':'blue')}
  ${iconCard('battery','Virtuele batterij',batteryText,batterySub,'mint')}
  ${iconCard('gas','Gas',gasText,gasSub,'peach')}
  ${iconCard('water','Water',waterText,waterSub,'blue')}
 </div>${this._detail?this._detailHtml(this._detail,h,c,plotted):''}<section class="chart-panel"><div class="chart-head"><div class="chart-title">Vermogen vandaag ${ehIcon('info')}</div><div class="now-power">${ehEsc(ehPower(pv))}</div></div><div class="chart-note">Zon nu · Tik op de grafiek of schuif naar een tijdstip</div>${graph}${plotted?.samples?.length&&!this._historyError?`<input type="range" class="timeline" data-eh-time-range="1" min="0" max="${plotted.samples.length-1}" value="${selectedIndex}" step="1" aria-label="Kies tijdstip voor de vermogensgrafiek"/><div class="reading" aria-live="polite">${ehSelectedReading(plotted,ids,selectedIndex)}</div>`:''}${legend}</section>
 ${missing.length?`<div class="notice">Niet beschikbaar of onbekende eenheid: ${ehEsc(missing.join(', '))}. Controleer de bronentiteiten.</div>`:''}
 <p class="foot">v${EH_VERSION} · ${c.charge_control_enabled===true?'Scriptbediening opt-in · afzonderlijke bevestiging':'Inzicht in je energie'} · Alfen loadbalancing blijft leidend</p></main>`}
 <nav class="nav" aria-label="Energiehuis navigatie">
  ${tab('Overzicht','home')}${tab('Cupra','car')}${tab('Cupra & Slim laden','bolt')}${tab('Batterij','battery')}${tab('Kosten','euro')}${tab('Meer','dots')}
 </nav>
</article>`;
 }
}
if(!customElements.get('energiehuis-card'))customElements.define('energiehuis-card',EnergiehuisCard);
window.customCards=window.customCards||[];
if(!window.customCards.some(x=>x.type==='energiehuis-card')){
 window.customCards.push({type:'energiehuis-card',name:'Energiehuis v1.30.0',description:'EnergieRegisseur Cockpit, live meetstatus, slim laden, budget, batterijvergelijker en veilig meterbeheer.'});
}

