// v1.3.0: tijdvakken en Home Assistant-langetermijnstatistieken.
const EH_PERIODS = [
 ['today','Vandaag'],['yesterday','Gisteren'],['7d','7 dagen'],
 ['30d','30 dagen'],['year','Dit jaar'],['prevyear','Vorig jaar']
];
const ehStatTime=v=>typeof v==='number'?v:(typeof v==='string'?Date.parse(v):NaN);
const ehDateText=d=>new Date(d).toLocaleDateString('nl-NL',{day:'numeric',month:'short',year:'numeric'});
const ehEnergy=n=>Number.isFinite(n)?ehFmt(n,2)+' kWh':'—';
const ehPeriodLimits=(p,now=new Date())=>{
 const day=(delta=0)=>new Date(now.getFullYear(),now.getMonth(),now.getDate()+delta);
 let from,to,step;
 if(p==='today'){from=day();to=now;step='hour';}
 else if(p==='yesterday'){from=day(-1);to=day();step='hour';}
 else if(p==='7d'){from=day(-6);to=now;step='day';}
 else if(p==='30d'){from=day(-29);to=now;step='day';}
 else if(p==='year'){from=new Date(now.getFullYear(),0,1);to=now;step='month';}
 else {from=new Date(now.getFullYear()-1,0,1);to=new Date(now.getFullYear(),0,1);step='month';}
 return {from,to,step};
};
const ehNextBoundary=(d,step)=>step==='hour'?new Date(d.getTime()+3600000):step==='day'?new Date(d.getFullYear(),d.getMonth(),d.getDate()+1):new Date(d.getFullYear(),d.getMonth()+1,1);
const ehBucketKey=(t,step)=>{
 const d=new Date(t);
 if(step==='hour')return `${ehDayKey(d)}-${d.getHours()}-${d.getTimezoneOffset()}`;
 if(step==='day')return ehDayKey(d);
 return `${d.getFullYear()}-${d.getMonth()+1}`;
};
function ehWindows(lim){
 const bins=[];
 for(let d=new Date(lim.from);d<lim.to&&bins.length<400;d=ehNextBoundary(d,lim.step)){
   const next=ehNextBoundary(d,lim.step);
   bins.push({t:d.getTime(),end:Math.min(next.getTime(),lim.to.getTime()),key:ehBucketKey(d,lim.step),label:lim.step==='hour'?ehClock(d.getTime()):lim.step==='day'?d.toLocaleDateString('nl-NL',{day:'numeric',month:'short'}):d.toLocaleDateString('nl-NL',{month:'short'})});
 }
 return bins;
}
// 'change' uit Recorder voorkomt foute waarden bij tellers die opnieuw starten.
// Als HA 'change' niet levert, gebruiken we verschillen in 'sum' met een extra voorafgaand tijdvak.
function ehCountersByWindow(response,ids,bins,step,h){
 const out={};
 for(const id of ids){
  if(!id)continue;
  const records=Array.isArray(response?.[id])?response[id].slice().sort((a,b)=>ehStatTime(a.start)-ehStatTime(b.start)):[];
  const totals=new Map(),means=new Map();let lastSum=null;
  for(const row of records){
   const start=ehStatTime(row.start),sum=ehNum(row.sum),change=ehNum(row.change),mean=ehNum(row.mean);
   if(!Number.isFinite(start))continue;
   const key=ehBucketKey(start,step);
   const diff=change!==null?change:(sum!==null&&lastSum!==null?sum-lastSum:null);
   if(sum!==null)lastSum=sum;
   // Een negatieve diff kan duiden op sensorvervanging of correctie: niet stilzwijgend omzetten naar nul.
   if(diff!==null&&diff>=-0.00001&&diff<100000){totals.set(key,(totals.get(key)||0)+Math.max(0,diff));}
   if(mean!==null)means.set(key,mean);
  }
  out[id]={totals,means};
 }
 return out;
}
function ehEnergyBuckets(resp,bins,step,c,h){
 const names=[c.import,c.export,c.zonne_energie,c.laad_energie,c.huis_energie,c.huis].filter(Boolean);
 const v=ehCountersByWindow(resp,[...new Set(names)],bins,step,h);
 const value=(id,b)=>id?v[id]?.totals.get(b.key):undefined;
 const mean=(id,b)=>id?v[id]?.means.get(b.key):undefined;
 const unit=id=>String(h?.states?.[id]?.attributes?.unit_of_measurement||'W').toLowerCase();
 return bins.map(b=>{
  const im=value(c.import,b),ex=value(c.export,b),sun=value(c.zonne_energie,b),ev=value(c.laad_energie,b);
  const direct=value(c.huis_energie,b);
  let home=direct,estimated=false;
  if(home===undefined&&[im,ex,sun,ev].every(Number.isFinite))home=Math.max(0,im-ex+sun-ev);
  if(home===undefined){
    const m=mean(c.huis,b);
    if(Number.isFinite(m)&&['w','kw'].includes(unit(c.huis))){
      const hours=(b.end-b.t)/3600000;
      home=Math.max(0,m*(unit(c.huis)==='kw'?1000:1)*hours/1000);estimated=true;
    }
  }
  return {...b,import:im??null,export:ex??null,sun:sun??null,ev:ev??null,home:home??null,estimated};
 });
}
function ehSeriesInfo(type){
 return {
   grid:{title:'Netvermogen',icon:'grid',note:'Afname en teruglevering apart (kWh).',parts:[['Afname','import','#65b5ff'],['Teruglevering','export','#51e3a5']]},
   sun:{title:'Zonnepanelen',icon:'sun',note:'Opwek uit de GoodWe-statistieken.',parts:[['Opwek','sun','#f6c33a']]},
   home:{title:'Huisverbruik',icon:'home',note:'Verbruik van de woning exclusief Cupra Born.',parts:[['Woning','home','#449ef8']]},
   car:{title:'Cupra Born',icon:'car',note:'Geladen energie gemeten door de Alfen.',parts:[['Laden','ev','#a98aff']]}
 }[type];
}
function ehDailyHistoryPoints(data,id,h,from,to){
 if(!id)return [];
 const group=Array.isArray(data)?data.find(arr=>Array.isArray(arr)&&arr.some(item=>item?.entity_id===id))||data[0]:data?.[id];
 if(!Array.isArray(group))return [];
 const unitNow=String(h?.states?.[id]?.attributes?.unit_of_measurement||'W').toLowerCase();
 const points=[];
 for(const o of group){
  const ts=o.lu??o.lc??o.last_updated??o.last_changed;
  const t=ehStatTime(ts); // HA compact history levert seconden als getal
  const time=typeof ts==='number'?ts*1000:t;
  const u=String(o.a?.unit_of_measurement||o.attributes?.unit_of_measurement||unitNow).toLowerCase();
  const v=ehNum(o.s??o.state);
  if(!Number.isFinite(time)||v===null||!['w','kw'].includes(u)||time>=to)continue;
  // Eerste status kan vóór het opgevraagde tijdvak vallen: dit is de beginstand.
  const at=Math.max(from,time);points.push({t:at,v:v*(u==='kw'?1000:1)});
 }
 return points.filter((p,i,a)=>i===0||p.t!==a[i-1].t||p.v!==a[i-1].v).sort((a,b)=>a.t-b.t);
}
// Geschat kWh uit werkelijk beschikbare vermogenshistorie (niet uit ontbrekende punten).
// Waarden op een 5-minutenraster worden als trapezia geïntegreerd, met zichtbare gaten.
function ehHomeHistoryEnergy(points,from,to){
 if(!Array.isArray(points)||points.length<2||!Number.isFinite(from)||!Number.isFinite(to)||to<=from)return null;
 let kwh=0,covered=0,derived=false,night=false;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dt=b.t-a.t;
  if(!(dt>0&&dt<=10*60000&&a.t>=from&&b.t<=to&&Number.isFinite(a.v)&&Number.isFinite(b.v)))continue;
  kwh+=(a.v+b.v)*0.5*dt/3600000000;
  covered+=dt;
  derived=derived||!!a.derived||!!b.derived;
  night=night||!!a.nightSolar||!!b.nightSolar;
 }
 if(!covered)return null;
 return {kwh,covered,complete:covered>=to-from-60000,derived,night};
}
// Eén autonome grafiek: groot genoeg voor aanraken op iPhone en aanklikbaar op desktop.
function ehMetricChart(type,period,buckets,raw,selectedAt,range){
 const day=period==='today'||period==='yesterday';
 const parts=ehSeriesInfo(type)?.parts||[];
 const W=690,H=252,L=53,R=13,T=18,B=40,CW=W-L-R,CH=H-T-B;
 const series=day&&raw?.length?[[parts[0][0],raw,parts[0][2]]]:parts.map(([label,key,color])=>[label,buckets.map(b=>({t:b.t,v:b[key]})),color]);
 const numbers=series.flatMap(s=>s[1].map(p=>p.v).filter(Number.isFinite));
 if(!numbers.length)return '<div class="no-chart">Voor deze periode zijn geen historische metingen beschikbaar. Controleer de Recorder-statistieken en gekoppelde entiteiten.</div>';
 const isRaw=day&&raw?.length;
 let min=Math.min(0,...numbers),max=Math.max(0,...numbers);
 const margin=Math.max((max-min)*0.12,isRaw?200:.05);min-=margin;max+=margin;
 const minT=range.from.getTime(),maxT=range.to.getTime();
 const xp=t=>L+(Math.max(minT,Math.min(t,maxT))-minT)/Math.max(1,maxT-minT)*CW;
 const yp=v=>T+(max-v)/(max-min)*CH;
 const axis=Array.from({length:5},(_,i)=>max-(max-min)*i/4).map(v=>`<line x1="${L}" x2="${W-R}" y1="${yp(v).toFixed(1)}" y2="${yp(v).toFixed(1)}" stroke="#c5deee2b"/><text x="${L-7}" y="${(yp(v)+4).toFixed(1)}" text-anchor="end" fill="#a6c4d6" font-size="12">${ehEsc(ehFmt(isRaw?v/1000:v,1))}</text>`).join('');
 const ticks=Array.from({length:5},(_,i)=>{
   const t=minT+(maxT-minT)*i/4,d=new Date(t);
   const label=day?ehClock(t):period==='year'||period==='prevyear'?d.toLocaleDateString('nl-NL',{month:'short'}):d.toLocaleDateString('nl-NL',{day:'numeric',month:'short'});
   const x=xp(t);return `<text x="${x.toFixed(1)}" y="${H-10}" text-anchor="${i===0?'start':i===4?'end':'middle'}" fill="#a6c4d6" font-size="12">${ehEsc(label)}</text>`;
 }).join('');
 let lines='';
 if(isRaw){
   lines=series.map(([label,pts,color])=>{
     // Maak echte onderbrekingen zichtbaar: verbind nooit twee losse meetreeksen.
     const segments=[];let part=[];
     for(const p of pts){
       if(Number.isFinite(p.v))part.push([xp(p.t),yp(p.v)]);
       else if(part.length){segments.push(part);part=[];}
     }
     if(part.length)segments.push(part);
     return segments.map(ps=>{
       if(ps.length===1)return `<circle cx="${ps[0][0]}" cy="${ps[0][1]}" r="4" fill="${color}"/>`;
       const d=ps.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
       return `<path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`;
     }).join('');
   }).join('');
 }else{
   // Groepsgewijze balken voorkomen dat ontbrekende meetdagen als nul worden weergegeven.
   const bw=Math.max(3,Math.min(24,CW/Math.max(1,buckets.length)*.7));
   lines=series.map(([name,pts,color],si)=>pts.map((p,i)=>{
     if(!Number.isFinite(p.v))return '';
     const bw2=Math.max(2,bw/series.length),x=xp(p.t)+si*bw2-bw/2;
     return `<rect x="${x.toFixed(1)}" y="${yp(Math.max(p.v,0)).toFixed(1)}" width="${bw2.toFixed(1)}" height="${Math.max(1,Math.abs(yp(p.v)-yp(0))).toFixed(1)}" rx="2" fill="${color}" opacity=".87"/>`;
   }).join('')).join('');
 }
 const available=isRaw?raw:buckets.filter(b=>parts.some(p=>Number.isFinite(b[p[1]])));
 const chosen=available.reduce((a,b)=>Math.abs(b.t-selectedAt)<Math.abs(a.t-selectedAt)?b:a,available[0]);
 const tx=chosen?xp(chosen.t):0;
 const cursor=chosen?`<line x1="${tx.toFixed(1)}" x2="${tx.toFixed(1)}" y1="${T}" y2="${H-B}" stroke="#f5faff" stroke-dasharray="4 4" opacity=".8"/>`:'';
 return `<svg class="metric-history" data-eh-metric-plot="1" data-eh-left="${L}" data-eh-right="${W-R}" data-eh-width="${W}" role="img" aria-label="${ehEsc(type==='grid'?'Afname en teruglevering':'Energiehistorie')}, tik of klik voor waarden per tijdstip" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><text x="6" y="12" fill="#a6c4d6" font-size="12">${isRaw?'kW':'kWh'}</text>${axis}<line x1="${L}" x2="${W-R}" y1="${yp(0).toFixed(1)}" y2="${yp(0).toFixed(1)}" stroke="#c2dcef66"/>${lines}${cursor}${ticks}<rect x="${L}" y="${T}" width="${CW}" height="${CH}" fill="transparent" style="cursor:crosshair"/></svg>`;
}
function ehCostComparePoints(stats,ids,bins,step,h,live,now){
 const mapped=ehCountersByWindow(stats,ids,bins,step,h);
 const val=(id,b)=>id?mapped[id]?.totals.get(b.key):undefined;
 let z=0,v1=0,v3=0,historyCount=0;
 const points=[];
 if(bins.length)points.push({t:bins[0].t,v1:0,v3:0});
 for(const b of bins){
   const dz=val(ids[0],b),d1=val(ids[1],b),d3=val(ids[2],b);
   if([dz,d1,d3].every(Number.isFinite)){
     z+=dz;v1+=d1;v3+=d3;historyCount++;
     points.push({t:b.end,v1:v1-z,v3:v3-z});
   }
 }
 if(live&&[live.z,live.v1,live.v3].every(Number.isFinite)){
   const endpoint={t:now.getTime(),v1:live.v1-live.z,v3:live.v3-live.z};
   if(points.length&&Math.abs(points[points.length-1].t-endpoint.t)<60000)points[points.length-1]=endpoint;
   else points.push(endpoint);
 }
 return {points,historyCount};
}
function ehCostCompareChart(result,selectedAt){
 const points=result?.points||[];
 if(points.length<2||!result?.historyCount)return '<div class="no-chart">Nog onvoldoende langetermijnstatistieken voor een betrouwbare cumulatieve grafiek.</div>';
 const W=690,H=260,L=58,R=14,T=18,B=42,CW=W-L-R,CH=H-T-B;
 const nums=points.flatMap(p=>[p.v1,p.v3]).filter(Number.isFinite);
 if(!nums.length)return '<div class="no-chart">Geen cumulatieve kostenverschillen beschikbaar.</div>';
 let min=Math.min(0,...nums),max=Math.max(0,...nums);
 const pad=Math.max((max-min)*.14,.5);min-=pad;max+=pad;
 const from=result.from.getTime(),to=result.to.getTime();
 const xp=t=>L+(Math.max(from,Math.min(t,to))-from)/Math.max(1,to-from)*CW;
 const yp=v=>T+(max-v)/(max-min)*CH;
 const axis=Array.from({length:5},(_,i)=>max-(max-min)*i/4).map(v=>'<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yp(v).toFixed(1)+'" y2="'+yp(v).toFixed(1)+'" stroke="#c5deee22"/><text x="'+(L-8)+'" y="'+(yp(v)+4).toFixed(1)+'" text-anchor="end" fill="#9fbdd0" font-size="11">€ '+ehEsc(ehFmt(v,1))+'</text>').join('');
 const ticks=Array.from({length:5},(_,i)=>{
   const t=from+(to-from)*i/4,d=new Date(t);
   const label=result.period==='month'?d.toLocaleDateString('nl-NL',{day:'numeric',month:'short'}):d.toLocaleDateString('nl-NL',{month:'short'});
   const x=xp(t);return '<text x="'+x.toFixed(1)+'" y="'+(H-10)+'" text-anchor="'+(i===0?'start':i===4?'end':'middle')+'" fill="#9fbdd0" font-size="11">'+ehEsc(label)+'</text>';
 }).join('');
 const series=[['v1','#4ee3a6'],['v3','#69b8ff']];
 const lines=series.map(([key,color])=>{
   const valid=points.filter(p=>Number.isFinite(p[key]));
   if(valid.length<2)return '';
   const d=valid.map((p,i)=>(i?'L':'M')+xp(p.t).toFixed(1)+','+yp(p[key]).toFixed(1)).join(' ');
   return '<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
 }).join('');
 const chosen=points.reduce((a,b)=>Math.abs(b.t-selectedAt)<Math.abs(a.t-selectedAt)?b:a,points[0]);
 const cx=xp(chosen.t);
 const dots=series.map(([key,color])=>Number.isFinite(chosen[key])?'<circle cx="'+cx.toFixed(1)+'" cy="'+yp(chosen[key]).toFixed(1)+'" r="5" fill="'+color+'" stroke="#071522" stroke-width="2"/>':'').join('');
 return '<svg class="cost-compare-chart" data-eh-cost-plot="1" data-eh-left="'+L+'" data-eh-right="'+(W-R)+'" data-eh-width="'+W+'" role="img" aria-label="Cumulatief kostenverschil ten opzichte van Vattenfall" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+axis+'<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yp(0).toFixed(1)+'" y2="'+yp(0).toFixed(1)+'" stroke="#f0f8ff99" stroke-width="1.8"/><text x="'+(L+4)+'" y="'+(yp(0)-6).toFixed(1)+'" fill="#d5e8f4" font-size="10">€0</text>'+lines+'<line x1="'+cx.toFixed(1)+'" x2="'+cx.toFixed(1)+'" y1="'+T+'" y2="'+(H-B)+'" stroke="#f5faff" stroke-dasharray="4 4" opacity=".75"/>'+dots+ticks+'<rect x="'+L+'" y="'+T+'" width="'+CW+'" height="'+CH+'" fill="transparent" style="cursor:crosshair"/></svg>';
}

function ehPricesForDay(h,c,now){
 const sources=[c.kwartier_forecast,c.prijs].filter(Boolean);
 let forecasts=sources.map(id=>ehForecast(h,id).filter(p=>p.t&&Number.isFinite(Date.parse(p.t))).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t)));
 const isQuarter=a=>a.filter((o,i)=>i&&Math.abs(Date.parse(o.t)-Date.parse(a[i-1].t)-900000)<30000).length>=2;
 // Detecteer automatisch een geschikte Zonneplan-kwartierforecast als er geen sensor is ingevuld.
 if(!forecasts.some(isQuarter)&&!c.kwartier_forecast){
   const other=Object.keys(h?.states||{}).filter(id=>/^sensor\.zonneplan_/i.test(id)&&/(electricity|elektriciteit|price|prijs|tariff|kwartier|quarter)/i.test(id)&&!sources.includes(id));
   for(const id of other){const entries=ehForecast(h,id).filter(q=>q.t&&Number.isFinite(Date.parse(q.t))).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));if(isQuarter(entries)){forecasts=[entries,...forecasts];break;}}
 }
 const quarters=forecasts.find(isQuarter)||[];
 const hourly=forecasts.find(a=>a.length&&!isQuarter(a))||[];
 const today=quarters.filter(q=>ehDayKey(new Date(q.t))===ehDayKey(now));
 const dayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const dayEnd=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
 const expected=(dayEnd-dayStart)/900000;
 const complete=today.length===expected&&new Set(today.map(x=>Date.parse(x.t))).size===expected;
 const fallbackSensor=(id)=>{
   const state=h?.states?.[id];if(!state)return null;
   const p=ehCurrentPrice(h,id)??ehPriceValue(state.attributes||{});
   if(p===null)return null;
   const a=state.attributes||{};
   const t=a.start_date??a.start??a.time??a.datetime??a.start_time??null;
   return {p,t:t&&Number.isFinite(Date.parse(t))?t:null};
 };
 const low=complete?today.reduce((a,b)=>b.p<a.p?b:a):fallbackSensor(c.kwartier_laag);
 const high=complete?today.reduce((a,b)=>b.p>a.p?b:a):fallbackSensor(c.kwartier_hoog);
 const currentQ=quarters.find(p=>{const t=Date.parse(p.t);return now.getTime()>=t&&now.getTime()<t+900000;});
 return {quarters,hourly,day:today,expected,complete,low,high,currentQ,currentHour:ehCurrentPrice(h,c.prijs)};
}
function ehHourlyFromPrices(quarter,hour){
 if(!quarter.length)return hour;
 // Merge: bestaande volledige uurprijzen blijven bruikbaar voor morgen, waar kwartierprijzen kunnen ontbreken.
 const result=new Map();
 for(const item of hour){
  const t=Date.parse(item.t);if(!Number.isFinite(t))continue;
  const start=Math.floor(t/3600000)*3600000;
  if(t===start)result.set(start,{t:new Date(start).toISOString(),p:item.p});
 }
 const grouped=new Map();for(const q of quarter){const t=Date.parse(q.t),key=Math.floor(t/3600000)*3600000;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(q);}
 for(const [t,items] of grouped){
   if(items.length!==4||new Set(items.map(x=>Math.floor(Date.parse(x.t)/900000))).size!==4)continue;
   result.set(t,{t:new Date(t).toISOString(),p:items.reduce((a,b)=>a+b.p,0)/4});
 }
 return [...result.values()].sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
}

const EH_CUPRA_PERIODS=[['today','Vandaag'],['week','Deze week'],['month','Deze maand'],['year','Dit jaar']];
const ehCupraPeriodLimits=(p,now=new Date())=>{
 const day=()=>new Date(now.getFullYear(),now.getMonth(),now.getDate());
 if(p==='today')return {from:day(),to:now,label:'Vandaag'};
 if(p==='week'){const d=day(),weekday=(d.getDay()+6)%7;return {from:new Date(d.getFullYear(),d.getMonth(),d.getDate()-weekday),to:now,label:'Deze week'};}
 if(p==='month')return {from:new Date(now.getFullYear(),now.getMonth(),1),to:now,label:'Deze maand'};
 return {from:new Date(now.getFullYear(),0,1),to:now,label:'Dit jaar'};
};
function ehHistoryEntity(data,id){
 if(!id)return [];
 if(Array.isArray(data)){
  const exact=data.find(arr=>Array.isArray(arr)&&arr.some(x=>x?.entity_id===id));
  return exact||[];
 }
 return Array.isArray(data?.[id])?data[id]:[];
}
function ehNumericHistory(data,id,h){
 const unitNow=String(h?.states?.[id]?.attributes?.unit_of_measurement||'').trim();
 return ehHistoryEntity(data,id).map(o=>{
   const raw=o.s??o.state,v=ehNum(raw),ts=o.lu??o.lc??o.last_updated??o.last_changed;
   const t=typeof ts==='number'?ts*1000:Date.parse(ts);
   const unit=String(o.a?.unit_of_measurement||o.attributes?.unit_of_measurement||unitNow).trim();
   return {t,v,unit};
 }).filter(o=>o.v!==null&&Number.isFinite(o.t)).sort((a,b)=>a.t-b.t);
}
function ehNearestPoint(series,t,maxGap=30*60*1000){
 if(!series?.length)return null;
 let best=null,bestGap=Infinity;
 for(const p of series){
   const gap=Math.abs(p.t-t);
   if(gap<bestGap){best=p;bestGap=gap;}
   if(p.t>t&&gap>bestGap)break;
 }
 return bestGap<=maxGap?best:null;
}
function ehToKwh(value,unit){
 if(!Number.isFinite(value))return null;
 const u=String(unit||'').toLowerCase().replace(/\s/g,'');
 if(u==='wh')return value/1000;
 if(u==='mwh')return value*1000;
 if(u==='kwh'||!u)return value;
 return value;
}
function ehCupraKmDaily(stats,id){
 const rows=Array.isArray(stats?.[id])?stats[id].slice().sort((a,b)=>ehStatTime(a.start)-ehStatTime(b.start)):[];
 return rows.map(row=>{
   const t=ehStatTime(row.start),change=ehNum(row.change),min=ehNum(row.min),max=ehNum(row.max);
   let km=change!==null?change:(min!==null&&max!==null?max-min:null);
   if(km!==null&&(!Number.isFinite(km)||km<-.01||km>1500))km=null;
   return Number.isFinite(t)?{t,km:km===null?null:Math.max(0,km)}:null;
 }).filter(Boolean);
}
function ehCupraDistanceSummary(daily,now=new Date(),coverageFrom=null){
 const startToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),weekday=(today.getDay()+6)%7;
 const startWeek=new Date(today.getFullYear(),today.getMonth(),today.getDate()-weekday).getTime();
 const startMonth=new Date(now.getFullYear(),now.getMonth(),1).getTime();
 const startYear=new Date(now.getFullYear(),0,1).getTime();
 const sumSince=from=>{if(Number.isFinite(coverageFrom)&&coverageFrom>from+60000)return null;const v=daily.filter(x=>x.t>=from&&x.t<=now.getTime()&&Number.isFinite(x.km)).map(x=>x.km);return v.length?v.reduce((a,b)=>a+b,0):0;};
 return {today:sumSince(startToday),week:sumSince(startWeek),month:sumSince(startMonth),year:sumSince(startYear)};
}
function ehCupraKmBuckets(daily,period,now=new Date()){
 const lim=ehCupraPeriodLimits(period,now);
 if(period==='year'){
   const months=new Map();
   for(const d of daily){
    if(d.t<lim.from.getTime()||d.t>lim.to.getTime()||!Number.isFinite(d.km))continue;
    const x=new Date(d.t),key=x.getFullYear()+'-'+x.getMonth();
    const old=months.get(key)||{t:new Date(x.getFullYear(),x.getMonth(),1).getTime(),km:0,label:x.toLocaleDateString('nl-NL',{month:'short'})};
    old.km+=d.km;months.set(key,old);
   }
   return [...months.values()].sort((a,b)=>a.t-b.t);
 }
 return daily.filter(d=>d.t>=lim.from.getTime()&&d.t<=lim.to.getTime()&&Number.isFinite(d.km)).map(d=>({...d,label:new Date(d.t).toLocaleDateString('nl-NL',{day:'numeric',month:'short'})}));
}
function ehCupraSegments(history,c,h,from,to,capacity){
 const ids={soc:c.cupra,mileage:c.cupra_mileage,range:c.cupra_range,temp:c.cupra_outside_temp,target:c.cupra_target_temp,climate:c.cupra_climate_usage,board:c.cupra_onboard_usage,alfen:c.laad_energie};
 const series=Object.fromEntries(Object.entries(ids).map(([k,id])=>[k,ehNumericHistory(history,id,h)]));
 const anchors=series.mileage.filter(p=>p.t>=from.getTime()&&p.t<=to.getTime());
 const snapshots=anchors.map(m=>{
   const read=(key)=>key==='mileage'?m:ehNearestPoint(series[key],m.t);
   const s={t:m.t,mileage:m.v};
   for(const key of ['soc','range','temp','target','climate','board']){const p=read(key);s[key]=p?.v??null;}
   const ap=read('alfen');s.alfen=ap?ehToKwh(ap.v,ap.unit):null;
   return s;
 });
 const segments=[],chargeSegments=[];let homeChargeExcluded=0,externalChargeSuspected=0,noiseExcluded=0;
 for(let i=1;i<snapshots.length;i++){
   const a=snapshots[i-1],b=snapshots[i],km=b.mileage-a.mileage;
   // Bij lange meetgaten kan rijden/laden niet betrouwbaar worden gescheiden.
   if(b.t<=a.t||b.t-a.t>48*60*60*1000)continue;
   if(!Number.isFinite(km)||km<-.2||km>400)continue;
   const alfenDelta=Number.isFinite(a.alfen)&&Number.isFinite(b.alfen)?b.alfen-a.alfen:null;
   const homeCharged=Number.isFinite(alfenDelta)&&alfenDelta>.08;
   const socDrop=Number.isFinite(a.soc)&&Number.isFinite(b.soc)?a.soc-b.soc:null;
   const socGain=Number.isFinite(socDrop)?-socDrop:null;
   const externalCharge=Number.isFinite(socGain)&&socGain>=2&&!homeCharged;
   if(homeCharged)homeChargeExcluded++;if(externalCharge)externalChargeSuspected++;
   if(km<=.2)continue;
   const temp=Number.isFinite(a.temp)&&Number.isFinite(b.temp)?(a.temp+b.temp)/2:(Number.isFinite(b.temp)?b.temp:a.temp);
   const target=Number.isFinite(a.target)&&Number.isFinite(b.target)?(a.target+b.target)/2:(Number.isFinite(b.target)?b.target:a.target);
   const climate=Number.isFinite(a.climate)&&Number.isFinite(b.climate)?(a.climate+b.climate)/2:(Number.isFinite(b.climate)?b.climate:a.climate);
   const board=Number.isFinite(a.board)&&Number.isFinite(b.board)?(a.board+b.board)/2:(Number.isFinite(b.board)?b.board:a.board);
   let valid=!homeCharged&&!externalCharge&&Number.isFinite(socDrop)&&socDrop>=1&&socDrop<=40&&km>=3;
   let energy=valid?capacity*socDrop/100:null;
   let kwh100=valid?energy/km*100:null;
   let practicalRange=valid?km/socDrop*100:null;
   if(valid&&(!Number.isFinite(kwh100)||kwh100<7||kwh100>45||practicalRange<120||practicalRange>850)){valid=false;noiseExcluded++;energy=null;kwh100=null;practicalRange=null;}
   const predictedFull=Number.isFinite(a.range)&&Number.isFinite(a.soc)&&a.soc>5?a.range*100/a.soc:null;
   const rangeError=valid&&Number.isFinite(predictedFull)&&predictedFull>0?(practicalRange-predictedFull)/predictedFull*100:null;
   segments.push({start:a.t,end:b.t,km,socDrop,alfenDelta,homeCharged,externalCharge,valid,energy,kwh100,practicalRange,predictedFull,rangeError,temp,target,setpointGap:Number.isFinite(temp)&&Number.isFinite(target)?target-temp:null,setpointDemand:Number.isFinite(temp)&&Number.isFinite(target)?Math.abs(target-temp):null,climate,board});
 }
 // Laadefficiëntie wordt bewust op SOC-updates verankerd. Tijdens stilstaand laden
 // verandert de kilometerstand vaak niet en levert die sensor dus geen bruikbare ankers.
 const chargeAnchors=series.soc.filter(p=>p.t>=from.getTime()&&p.t<=to.getTime());
 for(let i=1;i<chargeAnchors.length;i++){
   const a=chargeAnchors[i-1],b=chargeAnchors[i],socGain=b.v-a.v;
   // Een langdurig ontbrekend meetinterval is geen betrouwbare laadsessie.
   if(b.t<=a.t||b.t-a.t>48*60*60*1000)continue;
   if(!Number.isFinite(socGain)||socGain<=.3)continue;
   const aAlfen=ehNearestPoint(series.alfen,a.t),bAlfen=ehNearestPoint(series.alfen,b.t);
   if(!aAlfen||!bAlfen)continue;
   const wallA=ehToKwh(aAlfen.v,aAlfen.unit),wallB=ehToKwh(bAlfen.v,bAlfen.unit);
   const wall=Number.isFinite(wallA)&&Number.isFinite(wallB)?wallB-wallA:null;
   if(!Number.isFinite(wall)||wall<.15)continue;
   const aKm=ehNearestPoint(series.mileage,a.t),bKm=ehNearestPoint(series.mileage,b.t);
   const moved=aKm&&bKm&&Number.isFinite(aKm.v)&&Number.isFinite(bKm.v)?Math.abs(bKm.v-aKm.v):0;
   if(moved>=1)continue;
   const batteryGain=capacity*socGain/100,eff=batteryGain/wall;
   if(!Number.isFinite(eff)||eff<.5||eff>1.08)continue;
   const tp=ehNearestPoint(series.temp,b.t),targetp=ehNearestPoint(series.target,b.t);
   chargeSegments.push({start:a.t,end:b.t,wall,batteryGain,eff,temp:tp?.v??null,target:targetp?.v??null});
 }
 return {segments,chargeSegments,anchors:snapshots.length,homeChargeExcluded,externalChargeSuspected,noiseExcluded,coverageFrom:snapshots[0]?.t??null,coverageTo:snapshots.at(-1)?.t??null};
}
function ehWeighted(items,key,weight='km'){
 const valid=items.filter(x=>Number.isFinite(x[key])&&Number.isFinite(x[weight])&&x[weight]>0);
 if(!valid.length)return null;
 const w=valid.reduce((a,b)=>a+b[weight],0);return w?valid.reduce((a,b)=>a+b[key]*b[weight],0)/w:null;
}
function ehPearson(items,xKey,yKey){
 const a=items.filter(x=>Number.isFinite(x[xKey])&&Number.isFinite(x[yKey]));
 if(a.length<8)return null;
 const mx=a.reduce((s,x)=>s+x[xKey],0)/a.length,my=a.reduce((s,x)=>s+x[yKey],0)/a.length;
 const num=a.reduce((s,x)=>s+(x[xKey]-mx)*(x[yKey]-my),0),dx=Math.sqrt(a.reduce((s,x)=>s+(x[xKey]-mx)**2,0)),dy=Math.sqrt(a.reduce((s,x)=>s+(x[yKey]-my)**2,0));
 return dx&&dy?num/(dx*dy):null;
}
function ehTempGroups(segments,capacity){
 const defs=[[-Infinity,0,'< 0°C'],[0,5,'0–5°C'],[5,10,'5–10°C'],[10,15,'10–15°C'],[15,20,'15–20°C'],[20,Infinity,'≥ 20°C']];
 const valid=segments.filter(s=>s.valid&&Number.isFinite(s.temp));
 const groups=defs.map(([lo,hi,label])=>{
  const rows=valid.filter(s=>s.temp>=lo&&s.temp<hi),km=rows.reduce((a,b)=>a+b.km,0),energy=rows.reduce((a,b)=>a+(b.energy||0),0);
  const kwh100=km>0?energy/km*100:null,range=Number.isFinite(kwh100)&&kwh100>0?capacity*100/kwh100:null;
  return {label,lo,hi,count:rows.length,km,kwh100,range};
 });
 const base=groups.find(g=>g.label==='15–20°C'&&g.km>=10&&Number.isFinite(g.range));
 for(const g of groups)g.delta=base&&Number.isFinite(g.range)?(g.range-base.range)/base.range*100:null;
 return {groups,baseline:base};
}
function ehCupraInsightMetrics(result,capacity){
 const valid=(result?.segments||[]).filter(s=>s.valid);
 const km=valid.reduce((a,b)=>a+b.km,0),energy=valid.reduce((a,b)=>a+(b.energy||0),0);
 const kwh100=km>0?energy/km*100:null,range=Number.isFinite(kwh100)&&kwh100>0?capacity*100/kwh100:null;
 const avgTemp=ehWeighted(valid,'temp'),avgTarget=ehWeighted(valid,'target'),avgGap=ehWeighted(valid,'setpointGap'),avgDemand=ehWeighted(valid,'setpointDemand');
 const predicted=ehWeighted(valid,'predictedFull'),rangeDelta=Number.isFinite(range)&&Number.isFinite(predicted)&&predicted>0?(range-predicted)/predicted*100:null;
 const tempCorrelation=ehPearson(valid,'temp','kwh100'),gapCorrelation=ehPearson(valid,'setpointDemand','kwh100');
 const charge=(result?.chargeSegments||[]).filter(x=>Number.isFinite(x.wall)&&Number.isFinite(x.batteryGain));
 const wallKwh=charge.reduce((a,b)=>a+b.wall,0),batteryGainKwh=charge.reduce((a,b)=>a+b.batteryGain,0);
 const chargeEfficiency=wallKwh>0?batteryGainKwh/wallKwh*100:null;
 const quality=valid.length>=10&&km>=200?'Sterk':valid.length>=4&&km>=60?'Opbouwend':'Beperkt';
 return {valid,km,energy,kwh100,range,avgTemp,avgTarget,avgGap,avgDemand,predicted,rangeDelta,tempCorrelation,gapCorrelation,chargeSamples:charge.length,wallKwh,batteryGainKwh,chargeEfficiency,quality};
}
function ehCupraKmChart(buckets,period){
 const rows=(buckets||[]).filter(x=>Number.isFinite(x.km));
 if(!rows.length)return '<div class="no-chart">Nog geen kilometerhistorie voor deze periode beschikbaar.</div>';
 const W=690,H=220,L=48,R=12,T=18,B=38,CW=W-L-R,CH=H-T-B,max=Math.max(1,...rows.map(x=>x.km));
 const minT=Math.min(...rows.map(x=>x.t)),maxT=Math.max(...rows.map(x=>x.t));
 const step=rows.length>1?CW/(rows.length-1):CW/2,bw=Math.max(3,Math.min(28,CW/Math.max(1,rows.length)*.62));
 const xp=(row,i)=>rows.length===1?L+CW/2:L+i*step;
 const yp=v=>T+(max-v)/max*CH;
 const grid=Array.from({length:4},(_,i)=>max-max*i/3).map(v=>'<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yp(v).toFixed(1)+'" y2="'+yp(v).toFixed(1)+'" stroke="#c5deee22"/><text x="'+(L-7)+'" y="'+(yp(v)+4).toFixed(1)+'" text-anchor="end" fill="#9fbdd0" font-size="11">'+ehEsc(ehFmt(v,0))+'</text>').join('');
 const bars=rows.map((r,i)=>{const x=xp(r,i)-bw/2,y=yp(r.km),h=Math.max(1,T+CH-y);return '<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="3" fill="#69b8ff" opacity=".9"><title>'+ehEsc(r.label||'')+' · '+ehEsc(ehFmt(r.km,1))+' km</title></rect>';}).join('');
 const tickIdx=[0,Math.floor((rows.length-1)/2),rows.length-1].filter((v,i,a)=>a.indexOf(v)===i);
 const ticks=tickIdx.map(i=>'<text x="'+xp(rows[i],i).toFixed(1)+'" y="'+(H-10)+'" text-anchor="'+(i===0?'start':i===rows.length-1?'end':'middle')+'" fill="#9fbdd0" font-size="11">'+ehEsc(rows[i].label||'')+'</text>').join('');
 return '<svg class="cupra-km-chart" role="img" aria-label="Gereden kilometers per '+(period==='year'?'maand':'dag')+'" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet"><text x="7" y="12" fill="#9fbdd0" font-size="11">km</text>'+grid+bars+ticks+'</svg>';
}

function ehCupraTempRangeChart(groups,currentTemp){
 const rows=(groups||[]).map((g,i)=>({...g,i})).filter(g=>Number.isFinite(g.range)&&g.count>0);
 if(rows.length<2)return '<div class="no-chart small">Nog te weinig temperatuurklassen voor een trendgrafiek.</div>';
 const W=690,H=235,L=52,R=14,T=18,B=48,CW=W-L-R,CH=H-T-B;
 const vals=rows.map(r=>r.range),rawMin=Math.min(...vals),rawMax=Math.max(...vals),pad=Math.max(15,(rawMax-rawMin)*.18);
 const min=Math.max(0,rawMin-pad),max=rawMax+pad;
 const xp=i=>L+i/5*CW,yp=v=>T+(max-v)/(max-min)*CH;
 const grid=Array.from({length:4},(_,i)=>max-(max-min)*i/3).map(v=>'<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yp(v).toFixed(1)+'" y2="'+yp(v).toFixed(1)+'" stroke="#c5deee22"/><text x="'+(L-7)+'" y="'+(yp(v)+4).toFixed(1)+'" text-anchor="end" fill="#9fbdd0" font-size="11">'+ehEsc(ehFmt(v,0))+'</text>').join('');
 const d=rows.map((r,j)=>(j?'L':'M')+xp(r.i).toFixed(1)+','+yp(r.range).toFixed(1)).join(' ');
 const currentIndex=Number.isFinite(currentTemp)?(currentTemp<0?0:currentTemp<5?1:currentTemp<10?2:currentTemp<15?3:currentTemp<20?4:5):-1;
 const dots=rows.map(r=>'<circle cx="'+xp(r.i).toFixed(1)+'" cy="'+yp(r.range).toFixed(1)+'" r="'+(r.i===currentIndex?6:4)+'" fill="'+(r.i===currentIndex?'#ffe09b':'#52dfad')+'" stroke="#071522" stroke-width="2"><title>'+ehEsc(r.label)+' · '+ehEsc(ehFmt(r.range,0))+' km · '+ehEsc(ehFmt(r.km,0))+' km historie</title></circle>').join('');
 const labels=(groups||[]).map((g,i)=>'<text x="'+xp(i).toFixed(1)+'" y="'+(H-15)+'" text-anchor="middle" fill="#9fbdd0" font-size="9">'+ehEsc(g.label)+'</text>').join('');
 return '<svg class="cupra-temp-chart" role="img" aria-label="Praktijkactieradius per temperatuurklasse" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet"><text x="7" y="12" fill="#9fbdd0" font-size="11">km</text>'+grid+'<path d="'+d+'" fill="none" stroke="#52dfad" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>'+dots+labels+'</svg>';
}
