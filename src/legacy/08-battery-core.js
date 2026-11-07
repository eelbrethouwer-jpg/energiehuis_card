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
