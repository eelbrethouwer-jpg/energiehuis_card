/*
 * Energiehuis v1.11.0 — Batterij Simulator 3.0 (alleen uitlezen)
 * Bronnen: HA Recorder P1 uurstatistieken en optionele Zonneplan-prijshistorie.
 * Batterijmodel verstuurt geen opdrachten. Scriptbediening uit v1.10.0 staat standaard uit.
 */
function eh20Limits(now,days=7){
 const windowDays=days===30?30:7;
 const d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 return {from:new Date(d.getFullYear(),d.getMonth(),d.getDate()-windowDays),to:d,step:'hour'};
}
function eh20EnergyUnit(h,id){
 const unit=String(h?.states?.[id]?.attributes?.unit_of_measurement||'').trim().toLowerCase();
 return unit==='kwh'?1:unit==='wh'?.001:null;
}
function eh20PriceUnit(h,id){
 const unit=String(h?.states?.[id]?.attributes?.unit_of_measurement||'').trim().toLowerCase().replace(/\s/g,'');
 return ['€/kwh','eur/kwh','euro/kwh'].includes(unit)?1:['ct/kwh','cent/kwh','cents/kwh'].includes(unit)?.01:null;
}
function eh20PriceTime(v){
 if(typeof v==='number'&&Number.isFinite(v))return v<1e11?v*1000:v;
 if(typeof v==='string'){const num=Number(v);if(Number.isFinite(num)&&v.trim()!=='')return num<1e11?num*1000:num;return Date.parse(v);}
 return NaN;
}
function eh20HourlyPrices(priceStats,history,bins,id,h){
 const factor=eh20PriceUnit(h,id),mapped=new Map();
 if(factor===null||!id)return mapped;
 const records=Array.isArray(priceStats?.[id])?priceStats[id]:[];
 for(const r of records){
  const t=eh20PriceTime(r.start),price=ehNum(r.mean);
  if(Number.isFinite(t)&&price!==null&&price>=-2&&price<=10)mapped.set(t,price*factor);
 }
 const grouped=Array.isArray(history)?(history.find(g=>Array.isArray(g)&&g.some(s=>s?.entity_id===id))||history[0]):null;
 const states=Array.isArray(history?.[id])?history[id]:Array.isArray(grouped)?grouped:[];
 const observations=states.map(s=>({t:eh20PriceTime(s.last_changed??s.last_updated??s.lc??s.lu),p:ehNum(s.state??s.s)}))
  .filter(s=>Number.isFinite(s.t)&&s.p!==null&&s.p>=-2&&s.p<=10).sort((a,b)=>a.t-b.t);
 for(const b of bins){
  if(mapped.has(b.t))continue;
  // Require an actual nearby price observation, not a stretched stale price.
  const obs=observations.find(s=>Math.abs(s.t-b.t)<=10*60000);
  if(obs)mapped.set(b.t,obs.p*factor);
 }
 return mapped;
}
/* Battery-only window builder. The shared ehWindows() intentionally caps unrelated charts
   at 400 buckets; a 30-day battery period requires up to 721 hourly buckets with DST. */
function eh24BatteryWindows(lim){
 const bins=[],max=24*31+2;
 for(let d=new Date(lim.from);d<lim.to&&bins.length<max;d=ehNextBoundary(d,'hour')){
  const next=ehNextBoundary(d,'hour');
  if(!(next>d))break;
  bins.push({t:d.getTime(),end:Math.min(next.getTime(),lim.to.getTime()),key:ehBucketKey(d,'hour')});
 }
 return bins;
}
function eh20HourlyRows(stats,c,h,lim,prices){
 const bins=eh24BatteryWindows(lim),fIn=eh20EnergyUnit(h,c.import),fOut=eh20EnergyUnit(h,c.export);
 if(fIn===null||fOut===null)return {rows:[],bins,error:'P1-energiesensoren moeten een bekende eenheid (kWh of Wh) hebben.'};
 const groups=ehCountersByWindow(stats,[c.import,c.export],bins,'hour',h);
 const get=(id,b)=>groups[id]?.totals?.get(b.key);
 const rows=bins.map(b=>{
  const a=get(c.import,b),e=get(c.export,b);
  const ok=Number.isFinite(a)&&Number.isFinite(e)&&a>=0&&e>=0;
  return {t:b.t,end:b.end,import:ok?a*fIn:null,export:ok?e*fOut:null,price:prices.has(b.t)?prices.get(b.t):null};
 });
 return {rows,bins,error:null};
}
function eh20Percentile(values,q){
 if(!values.length)return null;
 const arr=values.slice().sort((a,b)=>a-b);
 return arr[Math.floor(Math.max(0,Math.min(1,q))*(arr.length-1))];
}
function eh21BatteryProfile(cap,config={}){
 const size=[5,10,15].includes(Number(cap))?Number(cap):10;
 const defaultPower=eh17N(config.battery_sim_power_kw);
 const power=defaultPower!==null&&defaultPower>0?defaultPower:3;
 const option=(key,def,min,max)=>{
  const n=eh17N(config['battery_'+size+'_'+key]);
  return n!==null&&n>=min&&n<=max?n:def;
 };
 const usablePct=option('usable_pct',100,1,100);
 return {capacity:size,usablePct,usableCapacity:size*usablePct/100,
  chargeKw:option('charge_kw',power,.1,20),
  dischargeKw:option('discharge_kw',power,.1,20)};
}
function eh20Simulate(rows,cap,roundtrip,power,mode,buy,sell,profile=null){
 const p=profile&&profile.capacity===cap?profile:eh21BatteryProfile(cap,{battery_sim_power_kw:power});
 const usable=Math.max(.01,Math.min(cap,p.usableCapacity));
 const chargeKw=p.chargeKw>0?p.chargeKw:3,dischargeKw=p.dischargeKw>0?p.dischargeKw:3;
 const eta=Number.isFinite(roundtrip)&&roundtrip>0&&roundtrip<=1?roundtrip:.88;
 const chargeEff=Math.sqrt(eta),dischargeEff=Math.sqrt(eta);
 const valid=rows.filter(r=>Number.isFinite(r.import)&&Number.isFinite(r.export)&&r.import>=0&&r.export>=0);
 const pricesComplete=valid.length>0&&valid.every(r=>Number.isFinite(r.price));
 if(mode==='smart'&&!pricesComplete)return null;
 const threshold=pricesComplete?eh20Percentile(valid.map(r=>r.price),.25):null;
 let soc=0,pvCharge=0,gridCharge=0,served=0,benefit=0,lostExport=0,lastEnd=null;
 let avoidedPurchase=0,gridPurchase=0;
 let pvNotStored=0,pvLimitedCapacity=0,pvLimitedPower=0,fullHours=0,peakSoc=0,energyAtGaps=0;
 const points=[];
 for(const r of rows){
  if(!Number.isFinite(r.import)||!Number.isFinite(r.export)||r.import<0||r.export<0){
   energyAtGaps+=soc;soc=0;lastEnd=null;points.push({t:r.t,soc:null});continue;
  }
  if(lastEnd!==null&&lastEnd!==r.t){energyAtGaps+=soc;soc=0;}
  lastEnd=r.end;
  const hours=Math.max(0,Math.min(1.1,(r.end-r.t)/3600000));
  const maxCharge=chargeKw*hours,maxDischarge=dischargeKw*hours;
  const price=pricesComplete?r.price:buy;
  let chargedSolar=0,chargedGrid=0,used=0,fullRejected=0,powerRejected=0;
  if(r.export>0){
   const space=Math.max(0,(usable-soc)/chargeEff);
   chargedSolar=Math.max(0,Math.min(r.export,maxCharge,space));
   soc+=chargedSolar*chargeEff;
   lostExport+=chargedSolar*sell;
   powerRejected=Math.max(0,r.export-Math.min(r.export,maxCharge));
   fullRejected=Math.max(0,Math.min(r.export,maxCharge)-chargedSolar);
   pvLimitedPower+=powerRejected;
   pvLimitedCapacity+=fullRejected;
   pvNotStored+=Math.max(0,r.export-chargedSolar);
   if(fullRejected>1e-7)fullHours++;
  }
  // An hour with export cannot also discharge: hourly P1 samples lack event order.
  if(r.export===0&&mode==='smart'&&price<=threshold){
   const future=valid.filter(v=>v.t>r.t&&v.t<r.t+24*3600000);
   const high=future.length?Math.max(...future.map(v=>v.price)):null;
   if(high!==null&&high*eta>price+.015){
    chargedGrid=Math.max(0,Math.min(maxCharge,(usable-soc)/chargeEff));
    soc+=chargedGrid*chargeEff;
    gridCharge+=chargedGrid;
    benefit-=chargedGrid*price;
    gridPurchase+=chargedGrid*price;
   }
  }
  if(r.export===0&&chargedGrid===0&&r.import>0){
   used=Math.max(0,Math.min(r.import,maxDischarge,soc*dischargeEff));
   soc-=used/dischargeEff;served+=used;benefit+=used*price;avoidedPurchase+=used*price;
  }
  soc=Math.max(0,Math.min(usable,soc));peakSoc=Math.max(peakSoc,soc);
  pvCharge+=chargedSolar;
  points.push({t:r.t,soc,chargedSolar,chargedGrid,discharged:used,
   import:r.import,export:r.export,price:r.price,fullRejected,powerRejected});
 }
 return {capacity:cap,usableCapacity:usable,usablePct:usable/cap*100,chargeKw,dischargeKw,
  mode,points,pvCharge,gridCharge,served,endingSoc:soc,peakSoc,pvNotStored,
  pvLimitedCapacity,pvLimitedPower,fullHours,unobservedResetKwh:energyAtGaps,
  savings:benefit-lostExport,avoidedPurchase,gridPurchase,lostExport,
  assumedPrices:!pricesComplete,priceComplete:pricesComplete,
  hours:valid.length,missingHours:rows.length-valid.length};
}
function eh20Chart(result,pickedIndex){
 if(!result||!result.points?.length)return '<p class="subtle">Geen betrouwbare uurpunten voor de grafiek.</p>';
 const points=result.points;
 const segments=[];let current=[];
 for(let i=0;i<points.length;i++){
  const p=points[i];
  if(p.soc===null){if(current.length)segments.push(current);current=[];continue;}
  current.push(((i/Math.max(1,points.length-1))*640).toFixed(1)+','+(117-(p.soc/(result.usableCapacity||result.capacity))*100).toFixed(1));
 }
 if(current.length)segments.push(current);
 const lines=segments.map(s=>'<polyline fill="none" stroke="#54e8b7" stroke-width="3" stroke-linejoin="round" points="'+s.join(' ')+'"/>').join('');
 const selected=points[Math.max(0,Math.min(points.length-1,pickedIndex??points.length-1))];
 const marker=selected?.soc!==null?'<circle cx="'+((Math.max(0,Math.min(points.length-1,pickedIndex??points.length-1))/Math.max(1,points.length-1))*640).toFixed(1)+'" cy="'+(117-(selected.soc/(result.usableCapacity||result.capacity))*100).toFixed(1)+'" r="6" fill="#ffcc65" stroke="#fff" stroke-width="2"/>':'';
 return '<svg class="eh20-soc-chart" viewBox="0 0 640 144" role="img" aria-label="Historische berekende batterijvulling per uur, 0 tot '+(result.usableCapacity||result.capacity)+' kWh">'+
  '<line x1="0" y1="117" x2="640" y2="117" stroke="#849cab" stroke-width="1"/>'+
  '<line x1="0" y1="17" x2="640" y2="17" stroke="#849cab" stroke-width="1" stroke-dasharray="5 5"/>'+
  '<text x="3" y="13" fill="#bdd5e4" font-size="11">'+(result.usableCapacity||result.capacity)+' kWh</text>'+
  '<text x="3" y="135" fill="#bdd5e4" font-size="11">0 kWh</text>'+lines+marker+'</svg>';
}

