/* Battery flow visualization: derived only from the already simulated hourly P1 series.
   No physical battery telemetry, no additional HA queries or service calls. */
function eh23BatteryDays(rows){
 const days=[],keys=new Map();
 for(let i=0;i<(rows?.length||0);i++){
  if(!Number.isFinite(rows[i]?.t))continue;
  const d=new Date(rows[i].t);
  const key=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
  if(!keys.has(key)){keys.set(key,days.length);days.push({key,date:d,indices:[]});}
  days[keys.get(key)].indices.push(i);
 }
 return days;
}
function eh23BatteryDay(card,rows){
 const days=eh23BatteryDays(rows);
 if(!days.length)return {days,day:null,index:-1};
 const index=Number.isInteger(card?._eh23DayIndex)?Math.max(0,Math.min(days.length-1,card._eh23DayIndex)):days.length-1;
 return {days,day:days[index],index};
}
function eh23BatterySelectedHour(card,rows){
 const day=eh23BatteryDay(card,rows).day;
 if(!day?.indices.length)return 0;
 const chosen=card?._eh20Selected;
 if(Number.isInteger(chosen)&&day.indices.includes(chosen))return chosen;
 return day.indices.slice().reverse().find(i=>Number.isFinite(rows[i]?.import)&&Number.isFinite(rows[i]?.export))??day.indices[day.indices.length-1];
}

/* Battery 5.0: HomeWizard-style dual-axis chart.
   Power/energy values are entirely simulated from P1 hourly statistics; SOC is NOT measured.
   Day is hourly. Week and Month aggregate recorded hours into calendar-day buckets.
   A year plot is withheld until real longer-term simulator input is available. */
function eh24BatteryBuckets(card,simulation,rows,period='day'){
 const days=eh23BatteryDays(rows),selected=eh23BatteryDay(card,rows);
 if(!days.length||!simulation?.points?.length)return {buckets:[],selected};
 const chosen=period==='week'?days.slice(Math.max(0,selected.index-6),selected.index+1):
  period==='month'?days.slice(Math.max(0,selected.index-29),selected.index+1):[selected.day];
 const buckets=[];
 for(const d of chosen){
  if(!d)continue;
  const groups=period==='day'?d.indices.map(i=>[i]):[d.indices];
  for(const group of groups){
   let pv=0,grid=0,out=0,known=0,lastSoc=null;
   for(const i of group){
    const p=simulation.points[i],r=rows[i];
    if(p&&Number.isFinite(p.soc)&&Number.isFinite(r?.import)&&Number.isFinite(r?.export)){
     pv+=Math.max(0,p.chargedSolar||0);
     grid+=Math.max(0,p.chargedGrid||0);
     out+=Math.max(0,p.discharged||0);
     lastSoc=p.soc;known++;
    }
   }
   const full=period==='day'?1:group.length;
   const missing=known<full || (period!=='day'&&group.length<23);
   const valid=known>0;
   const time=rows[group[0]]?.t;
   const title=period==='day'?new Date(time).toLocaleString('nl-NL',{hour:'2-digit',minute:'2-digit'}):
    d.date.toLocaleDateString('nl-NL',{day:'numeric',month:'short'});
   buckets.push({t:time,title,dayIndex:days.indexOf(d),hour:group[0],valid,pv,grid,out,
    missing,missingHours:full-known,soc:valid?lastSoc:null});
  }
 }
 return {buckets,selected};
}
function eh24AreaPath(buckets,xAt,yAt,baseline){
 const sections=[];let current=[];
 function close(){
  if(current.length){sections.push('M '+current[0][0]+' '+baseline+' L '+current.map(p=>p.join(' ')).join(' L ')+' L '+current[current.length-1][0]+' '+baseline+' Z');current=[];}
 }
 for(let i=0;i<buckets.length;i++){
  if(!buckets[i].valid){close();continue;}
  current.push([xAt(i).toFixed(2),yAt(buckets[i]).toFixed(2)]);
 }
 close();return sections.join(' ');
}
function eh24SocPath(buckets,xAt,top,bottom,usable){
 const segments=[];let one=[];
 for(let i=0;i<buckets.length;i++){
  const b=buckets[i];
  if(!b.valid||!Number.isFinite(b.soc)||b.missing){
   if(one.length)segments.push(one);one=[];continue;
  }
  one.push([xAt(i).toFixed(2),(bottom-(b.soc/usable)*(bottom-top)).toFixed(2)]);
 }
 if(one.length)segments.push(one);
 return segments.map(points=>'<polyline fill="none" stroke="#f6f8ff" stroke-width="2.8" stroke-dasharray="7 5" stroke-linejoin="round" stroke-linecap="round" points="'+points.map(p=>p.join(',')).join(' ')+'"/>').join('');
}
function eh23BatteryFlowChart(card,simulation,rows){
 if(!simulation?.points?.length)return '<p class="eh20-notice">Er is nog geen betrouwbare uurhistorie voor laad- en ontlaadstromen.</p>';
 const period=['day','week','month'].includes(card?._eh24GraphPeriod)?card._eh24GraphPeriod:'day';
 const {buckets,selected}=eh24BatteryBuckets(card,simulation,rows,period);
 if(!buckets.length)return '<p class="eh20-notice">Geen gemeten kalenderdagen beschikbaar.</p>';
 const picked=eh23BatterySelectedHour(card,rows),usable=Math.max(.01,simulation.usableCapacity||simulation.capacity);
 const width=720,left=46,right=56,baseline=117,top=22,bottom=212;
 const slot=(width-left-right)/Math.max(1,buckets.length),xAt=i=>left+slot*(i+.5);
 const scale=72/Math.max(.25,...buckets.map(b=>Math.max(b.pv+b.grid,b.out)));
 const yCharge=b=>baseline-(b.pv+b.grid)*scale,yPv=b=>baseline-b.pv*scale,yOut=b=>baseline+b.out*scale;
 const pvPath=eh24AreaPath(buckets,xAt,yPv,baseline);
 const chargePath=eh24AreaPath(buckets,xAt,yCharge,baseline);
 const outPath=eh24AreaPath(buckets,xAt,yOut,baseline);
 const socLine=eh24SocPath(buckets,xAt,top,bottom,usable);
 const labels=period==='day'?buckets.filter((b,i)=>i%6===0):
   buckets.filter((b,i)=>i%Math.max(1,Math.ceil(buckets.length/7))===0);
 const positions=labels.map(b=>buckets.indexOf(b));
 const index=period==='day'?buckets.findIndex(b=>b.hour===picked):buckets.findIndex(b=>b.dayIndex===selected.index);
 const totals=buckets.reduce((a,b)=>({pv:a.pv+b.pv,grid:a.grid+b.grid,out:a.out+b.out,missing:a.missing+(b.missing?1:0)}),{pv:0,grid:0,out:0,missing:0});
 const day=selected.day,days=selected.days,dayIndex=selected.index;
 const dayLabel=day?.date?.toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long',year:'numeric'})||'Geen datum';
 const opts=[['day','Dag'],['week','Week'],['month','Maand']].map(([key,label])=>
  '<button type="button" data-eh24-view="'+key+'" aria-pressed="'+(key===period)+'" class="'+(key===period?'selected':'')+'">'+label+'</button>').join('');
 const tabs='<div class="eh24-tabs" role="group" aria-label="Batterijgrafiek periode">'+opts+
  '<button type="button" disabled title="Jaarhistorie is niet beschikbaar in de huidige 7/30-dagensimulator">Jaar</button></div>';
 const nav='<div class="eh23-day-nav"><button type="button" data-eh23-step="-1" '+(dayIndex<=0?'disabled':'')+' aria-label="Vorige batterij-simulatiedag">‹</button>'+
  '<strong>'+ehEsc(dayLabel)+'</strong><button type="button" data-eh23-step="1" '+(dayIndex>=days.length-1?'disabled':'')+' aria-label="Volgende batterij-simulatiedag">›</button></div>';
 let highlights='',hitboxes='';
 for(let i=0;i<buckets.length;i++){
  const b=buckets[i],x=xAt(i);
  if(b.missing)highlights+='<rect x="'+(x-slot*.4).toFixed(2)+'" y="'+top+'" width="'+(slot*.8).toFixed(2)+'" height="'+(bottom-top)+'" fill="#8d96a6" opacity=".19"/>';
  if(i===index)highlights+='<line x1="'+x.toFixed(2)+'" y1="'+top+'" x2="'+x.toFixed(2)+'" y2="'+bottom+'" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 5"/>';
  const label=(period==='day'?b.title+' uur':b.title+' (dag)')+
   ': '+(b.valid?'laden '+ehFmt(b.pv+b.grid,2)+' kWh, ontladen '+ehFmt(b.out,2)+' kWh, batterij '+ehFmt(b.soc/usable*100,0)+'%':'geen P1-data')+
   (b.missing?', ontbrekende of onvolledige uurdata':'');
  hitboxes+='<rect '+(period==='day'?'data-eh23-hour="'+b.hour+'"':'data-eh24-day="'+b.dayIndex+'"')+
   ' x="'+(x-slot*.49).toFixed(2)+'" y="'+top+'" width="'+(slot*.98).toFixed(2)+'" height="'+(bottom-top)+'" fill="transparent" role="button" tabindex="0" aria-label="'+ehEsc(label)+'"><title>'+ehEsc(label)+'</title></rect>';
 }
 const maxEnergy=72/scale;
 const grid=[1,.5,0,-.5,-1].map(v=>{
  const y=(baseline-v*72).toFixed(2);
  return '<line x1="'+left+'" x2="'+(width-right)+'" y1="'+y+'" y2="'+y+'" stroke="'+(v===0?'#9ccfce':'#718ba3')+'" stroke-width="'+(v===0?'1.5':'1')+'" opacity="'+(v===0?'.85':'.3')+'"/>'+
   '<text x="'+(left-4)+'" y="'+(Number(y)+4)+'" text-anchor="end" font-size="10" fill="#c0d7df">'+ehFmt(v*maxEnergy,1)+'</text>';
 }).join('')+
 '<text x="2" y="12" font-size="10" fill="#c0d7df">kWh</text>'+
 '<text x="'+(width-43)+'" y="'+(top+4)+'" font-size="11" fill="#f4f6fb">100%</text>'+
 '<text x="'+(width-31)+'" y="'+(bottom-3)+'" font-size="11" fill="#f4f6fb">0%</text>';
 const columnBars=buckets.map((b,i)=>{
  if(!b.valid)return '';
  const center=xAt(i),barWidth=Math.max(3,Math.min(24,slot*.68)),opacity=b.missing?'.48':'.93';
  const rect=(top,height,fill,klass)=>height>.3?
   '<rect class="'+klass+'" x="'+(center-barWidth/2).toFixed(2)+'" y="'+top.toFixed(2)+'" width="'+barWidth.toFixed(2)+'" height="'+height.toFixed(2)+'" rx="2" fill="'+fill+'" opacity="'+opacity+'"/>':'';
  const pv=Math.max(0,b.pv)*scale,net=Math.max(0,b.grid)*scale,out=Math.max(0,b.out)*scale;
  return rect(baseline-pv,pv,'#bc5ce9','eh27-pv-bar')+
   rect(baseline-pv-net,net,'#9485ef','eh27-grid-bar')+
   rect(baseline,out,'#32d7a0','eh27-discharge-bar');
 }).join('');
 const axes=positions.map(i=>'<text x="'+xAt(i).toFixed(2)+'" y="233" font-size="11" fill="#bed0de" text-anchor="middle">'+ehEsc(buckets[i].title)+'</text>').join('');
 const graph='<svg class="eh23-flow-svg eh24-combined-svg" viewBox="0 0 '+width+' 244" role="group" aria-label="Gesimuleerde batterij; paarse laadenergie boven nul, groene ontlaadenergie onder nul, witte stippellijn batterijvulling in procent">'+
  grid+
  '<path class="eh24-charge" d="'+chargePath+'" fill="#bd64f2" fill-opacity=".07" stroke="#bd64f2" stroke-width="2" stroke-linejoin="round"/>'+
  '<path class="eh24-solar" d="'+pvPath+'" fill="#ae43e1" fill-opacity=".06" stroke="#c56cf2" stroke-width="1.2"/>'+
  '<path class="eh24-discharge" d="'+outPath+'" fill="#31c78e" fill-opacity=".06" stroke="#31c78e" stroke-width="2"/>'+
  columnBars+highlights+socLine+axes+hitboxes+'</svg>';
 const unavailable=period==='month'&&days.length<21?'<p class="eh20-notice">De maandweergave bevat slechts '+days.length+' beschikbare dagen; dit is geen volledige maand.</p>':'';
 const summary='<p class="eh23-flow-totals">Getoonde periode: '+(period==='day'?'uurwaarden': 'dagtotalen')+
  ' · geladen '+ehFmt(totals.pv+totals.grid,1)+' kWh (PV '+ehFmt(totals.pv,1)+' · net '+ehFmt(totals.grid,1)+
  ') · ontladen '+ehFmt(totals.out,1)+' kWh'+(totals.missing?' · '+totals.missing+' onvolledige meetpunten':'')+'</p>';
 return '<section class="eh23-flow eh24-flow" aria-label="Virtuele batterij laden ontladen en vulling">'+
  '<div class="eh23-flow-head"><h4>Batterijactiviteit</h4><small>Gesimuleerd, niet fysiek gemeten</small></div>'+
  tabs+nav+
  '<div class="eh23-legend"><span><i class="eh24-purple"></i>Laden uit zon</span><span><i class="eh24-lilac"></i>Netladen</span>'+
  '<span><i class="eh24-green"></i>Ontladen</span><span><i class="eh24-soc"></i>SOC %</span><span><i class="eh23-no-data"></i>Geen data</span></div>'+
  graph+summary+unavailable+
  '<details class="eh27-chart-info"><summary>Grafiek en databron</summary><p class="eh20-meta">Historische P1-uursimulatie, geen echte batterijtelemetrie. Dag = kWh per uur; week/maand = kWh per dag. SOC staat op de rechter procentas. Jaar vereist langere betrouwbare historie.</p></details></section>';
}


