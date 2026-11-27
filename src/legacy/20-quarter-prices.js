// Energiehuis 3.2 — Geld › Kwartieren: bekende prijzen per kwartier voor vandaag en morgen (alleen lezen).
// Bron: dezelfde kwartierprijzen die de rest van de kaart al gebruikt (ehPricesForDay). Wat niet bekend is blijft leeg.
const EHQT_EXAMPLE_KWH=20;
function ehQtTime(ms){return new Date(ms).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});}
function ehQtPrice(p){return Number.isFinite(p)?'€ '+ehFmt(p,3):'—';}
function ehQtDayBounds(now,offset){
 const s=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset).getTime();
 const e=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset+1).getTime();
 return {s,e};
}
const EHQT_CHART_W=360;
function ehQtDrawChart(o){
 const W=EHQT_CHART_W,H=172,X0=46,X1=W-6,Y0=14,Y1=134,n=Math.max(o.n,1),bw=(X1-X0)/n;
 const lo=Math.min(0,o.lo),hi=Math.max(0,o.hi,lo+0.001),y=v=>Y1-((v-lo)/(hi-lo))*(Y1-Y0),y0=y(0);
 const tips=new Array(n).fill(null);
 let bars='',grid='',axis='';
 for(const it of o.items){
  const x=X0+it.i*bw,w=Math.max(0.6,bw-0.4).toFixed(2);
  tips[it.i]=it.tip;
  if(it.miss){bars+=`<rect class="ehqt-miss" x="${x.toFixed(2)}" y="${Y0}" width="${w}" height="${Y1-Y0}"/>`;continue;}
  const yv=y(it.v),top=Math.min(yv,y0),h=Math.max(1,Math.abs(yv-y0));
  bars+=`<rect class="${it.cls}" x="${x.toFixed(2)}" y="${top.toFixed(1)}" width="${w}" height="${h.toFixed(1)}"/>`;
 }
 const ticks=[{v:hi,name:o.hiName||'hoogste'},{v:o.avg,name:'gemiddeld'},{v:0,name:''}];
 if(lo<0)ticks.push({v:lo,name:'laagste'});
 const used=[];
 for(const t of ticks){
  if(!Number.isFinite(t.v))continue;
  const yy=y(t.v);
  if(used.some(u=>Math.abs(u-yy)<10))continue;
  used.push(yy);
  grid+=`<line class="${t.v===0?'ehqt-base':'ehqt-grid'}" x1="${X0}" x2="${X1}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}"/><text class="ehqt-yl" x="${X0-4}" y="${(yy+3).toFixed(1)}" text-anchor="end">${ehEsc(o.fmt(t.v))}</text>`;
  if(t.name)grid+=`<text class="ehqt-yn" x="${X1-2}" y="${(yy-3).toFixed(1)}" text-anchor="end">${ehEsc(t.name)}</text>`;
 }
 for(let i=0;i<n;i+=(o.xEvery||12)){const x=X0+(o.xlabel?(i+0.5)*bw:i*bw);axis+=`<line class="ehqt-xt" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${Y1}" y2="${Y1+4}"/><text class="ehqt-xl" x="${x.toFixed(1)}" y="${H-8}" text-anchor="middle">${ehEsc(o.xlabel?o.xlabel(i):ehQtTime(o.first+i*(o.stepMs||EH_QT_STEP_MS)))}</text>`;}
 const stepMs=o.stepMs||EH_QT_STEP_MS,nx=o.nowMs>=o.first&&o.nowMs<o.first+n*stepMs?X0+((o.nowMs-o.first)/stepMs)*bw:null;
 const nowLine=nx===null?'':`<line class="ehqt-nowline" x1="${nx.toFixed(1)}" x2="${nx.toFixed(1)}" y1="${Y0-4}" y2="${Y1}"/>`;
 return `<div class="ehqt-chart" role="group" tabindex="0" data-ehqt-chart data-key="${ehEsc(o.key)}" data-n="${n}" data-x0="${X0}" data-bw="${bw.toFixed(4)}" data-tips="${ehEsc(JSON.stringify(tips))}" aria-label="${ehEsc(o.label)}. Tik of sleep over de grafiek, of gebruik de pijltoetsen, voor de waarde per balk."><div class="ehqt-slot"><span class="ehqt-hint">${ehEsc(o.hint||'Tik op een kwartier voor de prijs')}</span><div class="ehqt-tip" role="status" aria-live="polite" hidden></div></div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${ehEsc(o.label)}">${grid}${bars}${axis}${nowLine}<line class="ehqt-selline" visibility="hidden" y1="${Y0-4}" y2="${Y1}"/></svg></div>`;
}
// Dagbalken (bijvoorbeeld verbruik per dag): dezelfde assen en tikbare bubbel als de kwartiergrafiek.
function ehQtDayBars(days,o){
 const list=(Array.isArray(days)?days:[]).filter(d=>d&&Number.isFinite(d.kwh));
 if(!list.length)return '';
 const vals=list.map(d=>d.kwh),avg=vals.reduce((a,v)=>a+v,0)/vals.length;
 const dec=Math.max(...vals)<2?2:1,fmt=v=>ehFmt(v,dec)+' kWh';
 const items=list.map((d,i)=>{
  const dt=new Date(d.date+'T12:00:00'),lbl=dt.toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'');
  const rel=avg>0?Math.round((d.kwh/avg-1)*100):null;
  return {i,v:d.kwh,cls:'ehqt-neutral',tip:{time:lbl,main:fmt(d.kwh),sub:rel===null?'':(rel>=0?'+':'−')+Math.abs(rel)+'% t.o.v. gemiddelde'}};
 });
 const label=`${o.label||'Verbruik per dag'}: gemiddeld ${fmt(avg)}, hoogste ${fmt(Math.max(...vals))}, laagste ${fmt(Math.min(...vals))}`;
 return ehQtDrawChart({key:'d'+list[list.length-1].date,n:list.length,first:0,items,lo:Math.min(...vals),hi:Math.max(...vals),avg,fmt,nowMs:-1,label,xEvery:list.length>10?2:1,xlabel:i=>list[i].date.slice(8),hint:o.hint||'Tik op een dag voor het verbruik'});
}
function ehQtSelect(chart,i){
 let tips;try{tips=chart._ehTips||(chart._ehTips=JSON.parse(chart.dataset.tips||'[]'));}catch(e){tips=[];}
 const n=Number(chart.dataset.n)||tips.length;
 i=Math.max(0,Math.min(n-1,i));
 const x0=Number(chart.dataset.x0),bw=Number(chart.dataset.bw),cx=x0+(i+0.5)*bw,tip=tips[i];
 const line=chart.querySelector('.ehqt-selline'),box=chart.querySelector('.ehqt-tip'),hint=chart.querySelector('.ehqt-hint');
 if(line){line.setAttribute('x1',cx.toFixed(1));line.setAttribute('x2',cx.toFixed(1));line.setAttribute('visibility','visible');}
 if(hint)hint.hidden=true;
 if(box){
  box.hidden=false;
  box.innerHTML=tip?`<small>${ehEsc(tip.time)}</small><strong>${ehEsc(tip.main)}</strong>${tip.sub?`<span>${ehEsc(tip.sub)}</span>`:''}`:'<small>Geen gegevens</small>';
  const cw=chart.clientWidth||EHQT_CHART_W,bwid=box.offsetWidth||0,px=cx/EHQT_CHART_W*cw;
  box.style.left=Math.max(bwid/2,Math.min(cw-bwid/2,px))+'px';
 }
 chart._ehSel=i;
 return i;
}
function ehQtChart(day,stats,nowMs,isToday){
 const first=day.start,n=Math.max(day.expected,1);
 const items=day.slots.map(s=>{
  const i=Math.round((s.t-first)/EH_QT_STEP_MS),tier=ehQtTier(s.p,stats.min.p,stats.max.p);
  const cur=isToday&&nowMs>=s.t&&nowMs<s.t+EH_QT_STEP_MS;
  const rel=stats.avg>0?Math.round((s.p/stats.avg-1)*100):null;
  return {i,v:s.p,cls:'ehqt-'+tier+(cur?' ehqt-now':''),tip:{time:ehQtTime(s.t)+'–'+ehQtTime(s.t+EH_QT_STEP_MS),main:ehQtPrice(s.p)+' per kWh',sub:(rel===null?'':(rel>=0?'+':'−')+Math.abs(rel)+'% t.o.v. daggemiddelde')+(cur?' · nu':'')}};
 });
 const label=`Prijs per kwartier: laagste ${ehQtPrice(stats.min.p)} om ${ehQtTime(stats.min.t)}, hoogste ${ehQtPrice(stats.max.p)} om ${ehQtTime(stats.max.t)}, gemiddeld ${ehQtPrice(stats.avg)}`;
 return ehQtDrawChart({key:'p'+first,n,first,items,lo:stats.min.p,hi:stats.max.p,avg:stats.avg,fmt:ehQtPrice,nowMs:isToday?nowMs:-1,label});
}
function ehQtDayLabel(now,n){return new Date(now.getFullYear(),now.getMonth(),now.getDate()-n).toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'');}
function ehQtPills(sel,now){
 const one=[['today','Vandaag'],['tomorrow','Morgen'],['back:1','Gisteren']];
 const n=/^back:(\d+)$/.test(sel)?Number(sel.split(':')[1]):0;
 const opts=['<option value="">Eerder…</option>'].concat(Array.from({length:8},(_,i)=>i+2).map(d=>`<option value="${d}"${n===d?' selected':''}>${ehEsc(ehQtDayLabel(now,d))}</option>`)).join('');
 return `<div class="insight-periods ehqt-days" role="group" aria-label="Dag">${one.map(([id,l])=>`<button type="button" data-ehqt-day="${id}" aria-pressed="${sel===id}" class="${sel===id?'chosen':''}">${l}</button>`).join('')}<select data-ehqt-back aria-label="Eerdere dag" class="${n>=2?'chosen':''}">${opts}</select></div>`;
}
function ehQtPricesHtml(card){
 const h=card._hass,c=card.config||{},now=new Date(),nowMs=now.getTime();
 const sel=card._ehQtDay||'today';
 if(/^back:\d+$/.test(sel))return ehQtBackHtml(card,Number(sel.split(':')[1]),now);
 const which=sel==='tomorrow'?'tomorrow':'today',off=which==='tomorrow'?1:0;
 const info=ehPricesForDay(h,c,now);
 const b=ehQtDayBounds(now,off),day=ehQtDay(info.quarters,b.s,b.e);day.start=b.s;
 const pills=ehQtPills(which,now);
 const wrap=body=>`<section class="subsection ehqt" aria-label="Kwartierprijzen">${pills}${body}</section>`;
 if(!day.known){
  const why=!info.quarters.length?'Er zijn nog geen kwartierprijzen gevonden. Koppel een prijssensor met kwartierprijzen (kwartier_forecast) in de kaartconfiguratie.':which==='tomorrow'?'De prijzen van morgen zijn nog niet bekend. Ze verschijnen zodra je prijssensor ze meldt.':'Voor vandaag zijn geen kwartierprijzen bekend.';
  return wrap(`<p class="subtle">${ehEsc(why)}</p>`);
 }
 const stats=ehQtStats(day.slots,nowMs),isToday=off===0;
 const from=isToday?nowMs:b.s;
 const w2=ehQtWindow(day.slots,2,from),w4=ehQtWindow(day.slots,4,from);
 const head=isToday&&stats.current?`<p class="ehqt-headline">Nu ${ehEsc(ehQtPrice(stats.current.p))} per kWh${stats.vsAvg===null?'':' · '+ehEsc(ehFmt(Math.abs(stats.vsAvg)*100,0))+'% '+(stats.vsAvg>=0?'boven':'onder')+' het daggemiddelde'}</p>`:'';
 const tile=(k,v,sub)=>`<div class="ehqt-tile"><small>${ehEsc(k)}</small><strong>${ehEsc(v)}</strong><span>${ehEsc(sub)}</span></div>`;
 const tiles=`<div class="ehqt-tiles">${tile('Goedkoopste',ehQtPrice(stats.min.p),'om '+ehQtTime(stats.min.t))}${tile('Duurste',ehQtPrice(stats.max.p),'om '+ehQtTime(stats.max.t))}${tile('Gemiddeld',ehQtPrice(stats.avg),'per kWh')}</div>`;
 const win=w=>w?`<div><span>Goedkoopste ${w.hours} uur${isToday?' vanaf nu':''}</span><strong>${ehEsc(ehQtTime(w.start)+'–'+ehQtTime(w.end))}</strong><small>gemiddeld ${ehEsc(ehQtPrice(w.avg))}</small></div>`:'';
 const example=w4?`<p class="subtle">Voorbeeld: ${EHQT_EXAMPLE_KWH} kWh laden in dat 4-uursvenster kost ongeveer ${ehEsc('€ '+ehFmt(w4.avg*EHQT_EXAMPLE_KWH,2))}, tegen ${ehEsc('€ '+ehFmt(stats.avg*EHQT_EXAMPLE_KWH,2))} bij het daggemiddelde.</p>`:'';
 const windows=(w2||w4)?`<div class="subrows ehqt-windows">${win(w2)}${win(w4)}</div>${example}`:'';
 const miss=day.complete?'':`<p class="ehqt-warn">Nog niet volledig: ${day.known} van ${day.expected} kwartieren bekend. De rest wordt niet aangevuld of geschat.</p>`;
 const rows=day.slots.map(s=>`<tr><td>${ehEsc(ehQtTime(s.t))}</td><td>${ehEsc(ehQtPrice(s.p))}</td></tr>`).join('');
 const table=`<details class="ehqt-all"><summary>Alle kwartieren (${day.known})</summary><table><thead><tr><th>Tijd</th><th>€ per kWh</th></tr></thead><tbody>${rows}</tbody></table></details>`;
 return wrap(head+tiles+ehQtChart(day,stats,nowMs,isToday)+miss+windows+table+'<p class="subtle">Prijzen zoals je prijssensor ze meldt; alleen wat al bekend is.</p>');
}
function ehQtHtml(card){
 const html=ehQtPricesHtml(card);
 return /^back:\d+$/.test(card._ehQtDay||'')?html:html+ehQtWeatherHtml(card,new Date());
}
// ---- Terugkijken (tot circa 10 dagen terug: zo lang bewaart Home Assistant 5-minutenstatistiek en toestandsgeschiedenis) ----
function ehQtEur(v){return Number.isFinite(v)?(v<0?'−':'')+'€ '+ehFmt(Math.abs(v),2):'—';}
function ehQtCostChart(res,b){
 const n=Math.max(res.expected,1);
 const items=res.rows.map((r,i)=>{
  const time=ehQtTime(r.t)+'–'+ehQtTime(r.t+EH_QT_STEP_MS);
  if(!r.complete)return {i,miss:true,tip:{time,main:'Niet compleet',sub:'Prijs of meting ontbreekt'}};
  const v=r.netto!==null?r.netto:r.afname;
  return {i,v,cls:v<0?'ehqt-low':'ehqt-high',tip:{time,main:ehQtEur(v),sub:ehFmt(r.imp,2)+' kWh afname à '+ehQtPrice(r.p)+(r.exp>0?' · '+ehFmt(r.exp,2)+' kWh terug':'')}};
 });
 const vals=items.filter(x=>!x.miss).map(x=>x.v);
 if(!vals.length)return '';
 const avg=vals.reduce((a,v)=>a+v,0)/vals.length;
 const label='Kosten per kwartier: totaal '+(res.total.nettoKnown?ehQtEur(res.total.netto):ehQtEur(res.total.afname))+', gemiddeld '+ehQtEur(avg)+' per kwartier';
 return ehQtDrawChart({key:'c'+b.s,n,first:b.s,items,lo:Math.min(...vals),hi:Math.max(...vals),avg,fmt:ehQtEur,hiName:'duurste',nowMs:-1,label});
}
function ehQtBackHtml(card,n,now){
 const pills=ehQtPills('back:'+n,now);
 const wrap=body=>`<section class="subsection ehqt" aria-label="Kwartierkosten terugkijken">${pills}${body}</section>`;
 const e=card._ehQtBack&&card._ehQtBack[n];
 if(!e||e.loading)return wrap('<div class="energy-loading">Kwartieren ophalen uit de geschiedenis…</div>');
 if(e.error)return wrap(`<p class="ehqt-warn" role="alert">${ehEsc(e.error)}</p><button type="button" class="ehqt-retry" data-ehqt-retry="${n}">Opnieuw proberen</button>`);
 const res=e.res,b=e.bounds;
 if(!res.total.complete)return wrap(`<p class="subtle">Voor ${ehEsc(ehQtDayLabel(now,n))} zijn geen complete kwartieren beschikbaar. Home Assistant bewaart per kwartier ongeveer 10 dagen; verder terug kan alleen per uur (zie Energie › Balans).</p>`);
 const T=res.total,known=T.nettoKnown;
 const tile=(k,v,sub)=>`<div class="ehqt-tile"><small>${ehEsc(k)}</small><strong>${ehEsc(v)}</strong><span>${ehEsc(sub)}</span></div>`;
 const tiles=`<div class="ehqt-tiles">${tile(known?'Netto kosten':'Afnamekosten',ehQtEur(known?T.netto:T.afname),ehQtDayLabel(now,n))}${tile('Afname',ehFmt(T.imp,1)+' kWh',ehQtEur(T.afname))}${tile('Teruglevering',ehFmt(T.exp,1)+' kWh',known?ehQtEur(T.opbrengst):'vergoeding onbekend')}</div>`;
 const pricey=res.rows.filter(r=>r.complete).reduce((a,r)=>{const v=r.netto!==null?r.netto:r.afname;return !a||v>a.v?{r,v}:a;},null);
 const top=pricey?`<p class="subtle">Duurste kwartier: ${ehEsc(ehQtTime(pricey.r.t))} · ${ehEsc(ehQtEur(pricey.v))} (${ehEsc(ehFmt(pricey.r.imp,2))} kWh afname à ${ehEsc(ehQtPrice(pricey.r.p))}).</p>`:'';
 const note=known?'':'<p class="subtle">Zonder bekende terugleververgoeding (vanaf 2027) tonen we alleen de afnamekosten. Stel <code>terugleververgoeding</code> in voor het netto-bedrag.</p>';
 const miss=T.complete===res.expected?'':`<p class="ehqt-warn">${T.complete} van ${res.expected} kwartieren compleet. Kwartieren zonder prijs of meting tellen niet mee en worden niet geschat.</p>`;
 const rows=res.rows.filter(r=>r.complete).map(r=>`<tr><td>${ehEsc(ehQtTime(r.t))}</td><td>${ehEsc(ehQtPrice(r.p))}</td><td>${ehEsc(ehFmt(r.imp,2))}</td><td>${ehEsc(ehFmt(r.exp,2))}</td><td>${ehEsc(ehQtEur(r.netto!==null?r.netto:r.afname))}</td></tr>`).join('');
 const table=`<details class="ehqt-all"><summary>Alle kwartieren (${T.complete})</summary><table><thead><tr><th>Tijd</th><th>€/kWh</th><th>Afname</th><th>Terug</th><th>Kosten</th></tr></thead><tbody>${rows}</tbody></table></details>`;
 return wrap(tiles+ehQtCostChart(res,b)+top+miss+note+table+'<p class="subtle">Kosten = afname × prijs − teruglevering × vergoeding, per kwartier uit je meters. Alleen lezen.</p>');
}
async function ehQtFetchBack(h,c,n,now){
 const b=ehQtDayBounds(now,-n),iso=ms=>new Date(ms).toISOString();
 const pid=c.prijs&&h?.states?.[c.prijs]?c.prijs:c.kwartier_forecast;
 if(!pid||!h?.states?.[pid])throw new Error('Koppel een prijssensor (prijs of kwartier_forecast) om terug te kijken.');
 if(!c.import||!c.export)throw new Error('Koppel de tellers voor import en export om kosten per kwartier te berekenen.');
 if(typeof h.callWS!=='function')throw new Error('Geschiedenis is niet beschikbaar in deze weergave.');
 const [hist,stat]=await Promise.all([
  h.callWS({type:'history/history_during_period',start_time:iso(b.s-3600000),end_time:iso(b.e),entity_ids:[pid],include_start_time_state:true,significant_changes_only:false,minimal_response:true,no_attributes:true}),
  h.callWS({type:'recorder/statistics_during_period',start_time:iso(b.s),end_time:iso(b.e),statistic_ids:[c.import,c.export],period:'5minute',types:['change']})
 ]);
 const list=(hist&&hist[pid])||[];
 const states=list.map(x=>{const t=x.lu!==undefined?x.lu*1000:Date.parse(x.last_updated||x.last_changed||'');const v=ehNum(x.s!==undefined?x.s:x.state);return {t,p:v===null?null:eh3PriceConvert(h,pid,v)};});
 const series=id=>{const f=eh3Factor(h,id,'energy');const rows=Array.isArray(stat&&stat[id])?stat[id]:[];return f===null?[]:rows.map(r=>({start:ehStatTime(r.start),change:Number.isFinite(r.change)?r.change*f:null}));};
 const priceMap=ehQtPricesFromHistory(states,b.s,b.e),impMap=ehQtSumQuarters(series(c.import),b.s,b.e),expMap=ehQtSumQuarters(series(c.export),b.s,b.e);
 const feed=eh3Feedin(h,c);
 return {res:ehQtCostDay(priceMap,impMap,expMap,b.s,b.e,{salderingEndMs:EH_BAL_SALDERING_END_MS,feedin:feed.q}),bounds:b};
}

// ---- Weerindicatie voor de komende dagen (optioneel, via de weather-entiteit van Home Assistant; alleen lezen) ----
function ehWxFetch(h,id,type){
 return new Promise((resolve,reject)=>{
  const conn=h&&h.connection;
  if(!conn||typeof conn.subscribeMessage!=='function'){
   const f=h&&h.states&&h.states[id]&&h.states[id].attributes&&h.states[id].attributes.forecast;
   return Array.isArray(f)?resolve(f):reject(new Error('Deze weer-entiteit geeft geen voorspelling door.'));
  }
  let done=false,unsub=null;
  const finish=(v,e)=>{
   if(done)return;done=true;clearTimeout(timer);
   Promise.resolve(unsub).then(u=>{if(typeof u==='function')u();}).catch(()=>{});
   if(e)reject(e);else resolve(v);
  };
  const timer=setTimeout(()=>finish(null,new Error('Geen voorspelling ontvangen van de weer-entiteit.')),8000);
  try{
   unsub=conn.subscribeMessage(ev=>finish((ev&&ev.forecast)||[]),{type:'weather/subscribe_forecast',forecast_type:type,entity_id:id});
   Promise.resolve(unsub).catch(err=>finish(null,new Error('Deze weer-entiteit levert geen '+(type==='daily'?'dagelijkse':'uurlijkse')+' voorspelling.')));
  }catch(err){finish(null,err);}
 });
}
function ehWxLevelText(l){return l==='cheaper'?'Waarschijnlijk goedkoper':l==='pricier'?'Waarschijnlijk duurder':'Gemiddeld';}
// ---- Terugblik: de weerindicatie naast de werkelijke dagprijzen van de afgelopen dagen ----
async function ehWxFetchBack(h,c,now){
 const pid=c.prijs&&h?.states?.[c.prijs]?c.prijs:c.kwartier_forecast,wid=c.weather;
 if(!pid||!h?.states?.[pid])throw new Error('Geen prijssensor gekoppeld voor de terugblik.');
 if(typeof h.callWS!=='function')throw new Error('Geschiedenis is niet beschikbaar in deze weergave.');
 const first=ehQtDayBounds(now,-9),today=ehQtDayBounds(now,0),iso=ms=>new Date(ms).toISOString();
 const [wh,ph]=await Promise.all([
  h.callWS({type:'history/history_during_period',start_time:iso(first.s),end_time:iso(today.s),entity_ids:[wid],include_start_time_state:true,significant_changes_only:false,minimal_response:false,no_attributes:false}),
  h.callWS({type:'history/history_during_period',start_time:iso(first.s-3600000),end_time:iso(today.s),entity_ids:[pid],include_start_time_state:true,significant_changes_only:false,minimal_response:true,no_attributes:true})
 ]);
 const tempUnit=h.states[wid]?.attributes?.temperature_unit,windUnit=h.states[wid]?.attributes?.wind_speed_unit;
 const entries=((wh&&wh[wid])||[]).map(x=>{
  const a=x.a||x.attributes||{},t=x.lu!==undefined?x.lu*1000:Date.parse(x.last_updated||x.last_changed||'');
  const tmp=ehNum(a.temperature),fahr=String(a.temperature_unit||tempUnit||'').includes('F');
  return {t,wind:ehWxMs(a.wind_speed,a.wind_speed_unit||windUnit),cloud:ehWxCloud({cloud_coverage:a.cloud_coverage,condition:x.s!==undefined?x.s:x.state}),temp:tmp===null?null:(fahr?(tmp-32)/1.8:tmp)};
 });
 const days=ehWxHistoryDays(entries,ms=>ehDayKey(new Date(ms)));
 const states=((ph&&ph[pid])||[]).map(x=>{const t=x.lu!==undefined?x.lu*1000:Date.parse(x.last_updated||x.last_changed||'');const v=ehNum(x.s!==undefined?x.s:x.state);return {t,p:v===null?null:eh3PriceConvert(h,pid,v)};});
 const avgByKey=new Map();
 for(let k=1;k<=9;k++){
  const b=ehQtDayBounds(now,-k),m=ehQtPricesFromHistory(states,b.s,b.e),expected=Math.round((b.e-b.s)/EH_QT_STEP_MS);
  if(m.size===expected)avgByKey.set(ehDayKey(new Date(b.s)),[...m.values()].reduce((a,v)=>a+v,0)/m.size);
 }
 return ehWxBacktest(days.filter(d=>avgByKey.has(d.dayKey)).map(d=>({...d,avg:avgByKey.get(d.dayKey)})),ms=>new Date(ms).getMonth());
}
function ehWxActualText(a){return a==='cheaper'?'goedkoper':a==='pricier'?'duurder':'gemiddeld';}
function ehQtWeatherBackHtml(card,now){
 const e=card._ehWxBack;
 if(!e||e.loading)return '<p class="subtle">Terugblik ophalen…</p>';
 if(e.error)return `<p class="subtle">Terugblik niet beschikbaar: ${ehEsc(e.error)}</p>`;
 const r=e.res;
 if(!r.priced)return '<details class="ehqt-all"><summary>Hoe goed klopte dit de afgelopen dagen?</summary><p class="subtle">Er zijn te weinig complete dagen met prijs en weerdata om te beoordelen.</p></details>';
 const sum=r.signals?`${r.hits} van ${r.signals} duidelijke signalen kwamen uit (${r.priced} dagen beoordeeld).`:`Geen duidelijke signalen in de ${r.priced} beoordeelde dagen.`;
 const today0=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
 const rows=r.rows.slice().reverse().map(x=>{
  const d=new Date(x.t),back=Math.round((today0-new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime())/86400000);
  const wx=[x.wind!==null?ehFmt(x.wind,0)+' m/s':'',x.cloud!==null?Math.round(x.cloud)+'%':''].filter(Boolean).join(' · ');
  const res=x.hit===null?'–':x.hit?'✓':'✗';
  return `<tr><td>${ehEsc(ehQtDayLabel(now,back))}</td><td>${ehEsc(wx)}</td><td>${ehEsc(x.signal?ehWxLevelText(x.indication).replace('Waarschijnlijk ',''):'gemiddeld')}</td><td>${ehEsc(ehWxActualText(x.actual))}<small class="ehqt-sm">${ehEsc(ehQtPrice(x.avg))}</small></td><td>${res}</td></tr>`;
 }).join('');
 return `<details class="ehqt-all"><summary>Hoe goed klopte dit de afgelopen dagen?</summary><p>${ehEsc(sum)}</p><table><thead><tr><th>Dag</th><th>Weer</th><th>Indicatie</th><th>Werkelijk</th><th></th></tr></thead><tbody>${rows}</tbody></table><p class="subtle">Werkelijk = gemiddelde dagprijs minstens 10% onder of boven het gemiddelde van deze dagen. Kleine steekproef: lees dit als richting, niet als bewijs.</p></details>`;
}
function ehQtForecastEntries(h,id){
 const st=h&&h.states&&h.states[id];
 if(!st)return null;
 const a=st.attributes||{},u=String(a.unit_of_measurement||'').toLowerCase();
 const raw=[].concat(Array.isArray(a.forecast)?a.forecast:[],Array.isArray(a.prices)?a.prices:[],Array.isArray(a.data)?a.data:[],Array.isArray(a.raw_today)?a.raw_today:[],Array.isArray(a.raw_tomorrow)?a.raw_tomorrow:[]);
 const conv=v=>{const n=ehNum(v);if(n===null)return null;if(u.includes('mwh'))return n/1000;if(u.includes('cent')||u.includes('ct/'))return n/100;return n;};
 return raw.map(x=>{
  const t=Date.parse(((x&&(x.start_date??x.start??x.start_time??x.startsAt??x.datetime??x.time??x.from??x.date))??'')+'');
  let v=x&&(x.price_tax_included??x.price_incl_tax??x.price??x.value??x.price_per_kwh??x.tariff??x.amount);
  if(v&&typeof v==='object')v=v.amount??v.value;
  return {t,p:conv(v)};
 }).filter(x=>Number.isFinite(x.t)&&x.p!==null&&x.p>-5&&x.p<5);
}
function ehQtWeatherHtml(card,now){
 const c=card.config||{},h=card._hass,nowMs=now.getTime();
 const hasWx=!!(c.weather&&h?.states?.[c.weather]),fcId=c.prijsvoorspelling;
 const head='<h3 class="ehqt-wx-title">Komende dagen · indicatie en voorspelling</h3>';
 let fcMap=null,fcNote='';
 if(fcId){
  const ent=ehQtForecastEntries(h,fcId);
  if(ent===null)fcNote=`<p class="ehqt-warn">De prijsvoorspelling-sensor <code>${ehEsc(fcId)}</code> is niet gevonden.</p>`;
  else{const fd=ehQtForecastDays(ent,nowMs,ms=>ehDayKey(new Date(ms)));fcMap=new Map(fd.map(d=>[d.dayKey,d]));if(!fd.length)fcNote='<p class="subtle">De prijsvoorspelling-sensor bevat geen toekomstige prijzen (verwacht een lijst in <code>forecast</code>, <code>prices</code> of <code>data</code>).</p>';}
 }
 if(!hasWx&&!fcMap)return `<section class="ehqt-wx">${head}${fcNote}<p class="subtle">Koppel een weer-entiteit (<code>weather</code>) voor een indicatie op basis van wind en zon, en/of een sensor met voorspelde prijzen (<code>prijsvoorspelling</code>).</p></section>`;
 let days=[];
 if(hasWx){
  const e=card._ehWx;
  if(!e||e.loading)return `<section class="ehqt-wx">${head}<div class="energy-loading">Weersverwachting ophalen…</div></section>`;
  if(e.error&&!fcMap)return `<section class="ehqt-wx">${head}<p class="ehqt-warn">${ehEsc(e.error)}</p></section>`;
  if(!e.error)days=ehWxDays(e.daily,nowMs,h.states[c.weather].attributes?.wind_speed_unit,ms=>ehDayKey(new Date(ms)));
 }
 if(!days.length&&fcMap)days=[...fcMap.values()].map(d=>({dayKey:d.dayKey,t:d.t,wind:null,cloud:null,temp:null}));
 if(!days.length)return `<section class="ehqt-wx">${head}${fcNote}<p class="subtle">Er is geen dagelijkse voorspelling om te tonen.</p></section>`;
 const info=ehPricesForDay(h,c,now);
 const rows=days.map(d=>{
  const dt=new Date(d.t),off=Math.round((new Date(dt.getFullYear(),dt.getMonth(),dt.getDate())-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);
  const b=ehQtDayBounds(now,off),known=ehQtDay(info.quarters,b.s,b.e),st=known.complete?ehQtStats(known.slots,nowMs):null;
  const fc=fcMap&&fcMap.get(d.dayKey);
  const ind=ehWxIndication(d,dt.getMonth());
  const facts=[d.wind!==null?'wind '+ehFmt(d.wind,0)+' m/s':'',d.cloud!==null?'bewolking '+Math.round(d.cloud)+'%':'',d.temp!==null?ehFmt(d.temp,0)+'°C':''].filter(Boolean).join(' · ');
  let level,chip,right;
  if(st){level='average';chip='Prijs bekend';right=`<small>bekend gem.</small><strong>${ehEsc(ehQtPrice(st.avg))}</strong>`;}
  else if(fc){level=fc.level||'average';chip=fc.level?'Voorspeld '+ehWxLevelText(fc.level).replace('Waarschijnlijk ','').toLowerCase():'Voorspeld';right=`<small>voorspeld${fc.complete?'':' (deels)'}</small><strong>${ehEsc(ehQtPrice(fc.avg))}</strong>`;}
  else{level=ind.level;chip=ehWxLevelText(ind.level);right=`<small>${ehEsc(ind.reasons.join(', ')||'geen duidelijk signaal')}</small>`;}
  const sub=[facts,fc&&!st&&hasWx&&ind.reasons.length?'weer: '+ind.reasons.join(', '):''].filter(Boolean).join(' · ');
  return `<li class="ehqt-wx-${level}"><div><b>${ehEsc(off===0?'Vandaag':off===1?'Morgen':ehQtDayLabel(now,-off))}</b><span class="ehqt-chip">${ehEsc(chip)}</span><em>${ehEsc(sub)}</em></div><div class="ehqt-wx-r">${right}</div></li>`;
 }).join('');
 const foot=(fcMap?'Voorspelde prijzen komen van je sensor <code>'+ehEsc(fcId)+'</code> en zijn een schatting; het kan marktprijs zonder belasting en opslag zijn, vergelijk dagen dus onderling en niet met je kwartierprijzen. ':'')+(hasWx?'De weerindicatie is geen prijsvoorspelling: veel wind wijst vaak naar goedkoper, windstil en donker weer naar duurder. ':'')+'Zodra de prijzen van een dag bekend zijn, tonen we die.';
 return `<section class="ehqt-wx">${head}${fcNote}<ul class="ehqt-wx-list">${rows}</ul><p class="subtle">${foot}</p>${hasWx?ehQtWeatherBackHtml(card,now):''}</section>`;
}
function ehQtCss(){
 return [
  '/* EHQT KWARTIEREN */',
  '.ehqt-headline{font-size:15px;font-weight:800;margin:6px 0 10px}',
  '.ehqt-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:6px 0 12px}',
  '.ehqt-tile{background:#0b2132;border:1px solid #6d99b53d;border-radius:14px;padding:10px 9px;min-width:0}',
  '.ehqt-tile small{display:block;color:#a9c5d6;font-size:10px}.ehqt-tile strong{display:block;font-size:15px;margin:2px 0}.ehqt-tile span{display:block;color:#a9c5d6;font-size:10px}',
  '.ehqt-chart{position:relative;outline:none;-webkit-tap-highlight-color:transparent}.ehqt-chart:focus-visible{box-shadow:0 0 0 2px #38e8a1aa;border-radius:10px}',
  '.ehqt-chart svg{display:block;width:100%;height:auto;touch-action:pan-y;cursor:crosshair}.ehqt-chart text{fill:#9fbccd;font-size:9px;font-family:inherit}',
  '.ehqt-slot{position:relative;height:60px;margin-bottom:4px}.ehqt-hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#8fb0c4}',
  '.ehqt-tip{position:absolute;top:0;transform:translateX(-50%);min-width:120px;max-width:94%;box-sizing:border-box;padding:5px 10px;border-radius:12px;background:#0b2132;border:1px solid #38e8a199;box-shadow:0 6px 18px #0008;text-align:center;pointer-events:none;z-index:2}',
  '.ehqt-tip[hidden]{display:none}.ehqt-tip small{display:block;font-size:10px;color:#9fbccd}.ehqt-tip strong{display:block;font-size:15px;color:#fff;line-height:1.25}.ehqt-tip span{display:block;font-size:10px;color:#cfe3ef}',
  '.ehqt-tip:after{content:"";position:absolute;left:50%;bottom:-6px;width:10px;height:10px;background:#0b2132;border-right:1px solid #38e8a199;border-bottom:1px solid #38e8a199;transform:translateX(-50%) rotate(45deg)}',
  '.ehqt-grid{stroke:#6d99b52e;stroke-dasharray:3 3;stroke-width:1}.ehqt-xt{stroke:#6d99b566}.ehqt-selline{stroke:#fff;stroke-width:1.4}',
  '.ehqt-chart .ehqt-yl{fill:#cfe3ef;font-size:8.5px;font-weight:700}.ehqt-chart .ehqt-yn{fill:#8fb0c4;font-size:8px;paint-order:stroke;stroke:#0f2a3d;stroke-width:2.5px}',
  '.ehqt-base{stroke:#6d99b53d;stroke-width:1}.ehqt-nowline{stroke:#fff;stroke-width:1.2;stroke-dasharray:2 2}',
  '.ehqt-neutral{fill:#69d5bd}.ehqt-low{fill:#38e8a1}.ehqt-mid{fill:#61b7ff}.ehqt-high{fill:#ffb48a}.ehqt-now{stroke:#fff;stroke-width:1}',
  '.ehqt-windows{margin-top:10px}.ehqt-windows>div{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline;justify-content:space-between}',
  '.ehqt-warn{margin:10px 0;padding:10px 12px;border-radius:12px;background:#3b2a0d;border:1px solid #ffca4455;color:#ffe2a1;font-size:12px;line-height:1.4}',
  '.ehqt-wx{margin-top:18px;padding-top:6px}.ehqt-wx-title{font-size:15px;margin:0 0 8px}',
  '.ehqt-wx-list{list-style:none;margin:0 0 8px;padding:0;display:grid;gap:6px}.ehqt-wx-list li{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 11px;border-radius:12px;background:#0b2132;border:1px solid #6d99b52e}',
  '.ehqt-wx-list b{font-size:13px;margin-right:8px}.ehqt-wx-list em{display:block;font-style:normal;font-size:11px;color:#9fbccd;margin-top:3px}.ehqt-chip{display:inline-block;font-size:10px;font-weight:800;border-radius:999px;padding:3px 8px}',
  '.ehqt-wx-cheaper .ehqt-chip{background:#0f4d45;color:#aaffdc}.ehqt-wx-average .ehqt-chip{background:#173a55;color:#bfe0ff}.ehqt-wx-pricier .ehqt-chip{background:#5a2f1b;color:#ffd0b5}',
  '.ehqt-wx-r{text-align:right;max-width:44%;white-space:nowrap}.ehqt-wx-r small{display:block;font-size:10px;color:#9fbccd}.ehqt-wx-r strong{font-size:13px}',
  '.ehqt-all p{font-size:13px;line-height:1.4}.ehqt-sm{display:block;font-size:10px;color:#9fbccd}.ehqt-all td,.ehqt-all th{font-size:11px}',
  '.ehqt-retry{margin:6px 0;min-height:44px;padding:0 16px;border-radius:12px;background:#17604c;border:1px solid #55dfb1;color:#fff;font:inherit;font-weight:700;cursor:pointer}',
  '.ehqt-all summary{font-size:14px}.ehqt-all[open] summary{margin-bottom:6px}',
  '.ehqt-miss{fill:#143247;stroke:#6d99b544;stroke-dasharray:3 2}',
  '.ehqt-days select{appearance:none;border:1px solid #6d99b53d;background:#0b2132;color:#a9c5d6;border-radius:999px;padding:7px 11px;font:inherit;font-size:10px;font-weight:800;min-height:44px}.ehqt-days select.chosen{background:#0f4d45;border-color:#38e8a199;color:#eafff7}',
  '.ehqt-all{margin-top:12px}.ehqt-all summary{cursor:pointer;font-weight:800;min-height:44px;display:flex;align-items:center}',
  '.ehqt-all table{width:100%;border-collapse:collapse;font-size:12px}.ehqt-all th,.ehqt-all td{text-align:left;padding:5px 4px;border-bottom:1px solid #6d99b522}'
 ].join('\n');
}
(function ehQtInstall(){
 const P=EnergiehuisCard.prototype,previous=P._render,previousConfig=P.setConfig;
 P.setConfig=function(config){
  // Nieuwe configuratie (bijvoorbeeld in de editor): oude terugkijk- en weerresultaten horen daar niet meer bij.
  this._ehQtBack=null;this._ehWx=null;this._ehWxBack=null;
  return previousConfig.call(this,config);
 };
 P._render=function(){
  previous.call(this);
  const root=this.shadowRoot;
  if(!root)return;
  const style=root.querySelector('style');
  if(style&&!style.textContent.includes('/* EHQT KWARTIEREN */'))style.textContent+='\n'+ehQtCss();
  if(this._view==='costs'&&this._ehNvCur&&this._ehNvCur.seg==='quarters'&&!/^back:/.test(this._ehQtDay||'')){this._ehWxLoad();this._ehWxBackLoad();}
  const sel=this._ehQtSel;
  if(sel)root.querySelectorAll('[data-ehqt-chart]').forEach(c=>{if(c.dataset.key===sel.key)ehQtSelect(c,sel.i);});
  if(!this._ehQtEvents){
   this._ehQtEvents=true;
   const pick=v=>{
    this._ehQtDay=v;
    const m=/^back:(\d+)$/.exec(v);
    if(m)this._ehQtLoadBack(Number(m[1]));
    this._schedule();
   };
   root.addEventListener('click',e=>{
    const b=e.target?.closest?.('[data-ehqt-day]');
    if(b)pick(b.dataset.ehqtDay==='tomorrow'?'tomorrow':b.dataset.ehqtDay==='back:1'?'back:1':'today');
   });
   const idxAt=(chart,cx)=>{
    const svg=chart.querySelector('svg'),r=svg.getBoundingClientRect();
    if(!r.width)return 0;
    const vx=(cx-r.left)/r.width*EHQT_CHART_W;
    return Math.floor((vx-Number(chart.dataset.x0))/Number(chart.dataset.bw));
   };
   const chartOf=e=>e.target?.closest?.('[data-ehqt-chart]');
   const pick2=(chart,i)=>{const k=ehQtSelect(chart,i);this._ehQtSel={key:chart.dataset.key,i:k};};
   root.addEventListener('pointerdown',e=>{const ch=chartOf(e);if(!ch)return;ch._ehDown=true;pick2(ch,idxAt(ch,e.clientX));});
   root.addEventListener('pointermove',e=>{const ch=chartOf(e);if(!ch)return;if(e.pointerType==='mouse'||ch._ehDown)pick2(ch,idxAt(ch,e.clientX));});
   const up=e=>{root.querySelectorAll('[data-ehqt-chart]').forEach(c=>{c._ehDown=false;});};
   root.addEventListener('pointerup',up);root.addEventListener('pointercancel',up);
   root.addEventListener('keydown',e=>{
    const ch=chartOf(e);if(!ch||!/^Arrow(Left|Right)$|^(Home|End|Escape)$/.test(e.key))return;
    if(e.key==='Escape'&&!Number.isInteger(ch._ehSel))return;
    e.preventDefault();
    const n=Number(ch.dataset.n),cur=Number.isInteger(ch._ehSel)?ch._ehSel:(e.key==='ArrowLeft'?n:-1);
    const nx=e.key==='ArrowLeft'?cur-1:e.key==='ArrowRight'?cur+1:e.key==='Home'?0:e.key==='End'?n-1:null;
    if(nx===null){this._ehQtSel=null;this._schedule();return;}
    pick2(ch,nx);
   });
   root.addEventListener('click',e=>{
    const r=e.target?.closest?.('[data-ehqt-retry]');
    if(!r)return;
    const n=Number(r.dataset.ehqtRetry);
    if(this._ehQtBack)this._ehQtBack[n]=null;
    this._ehQtLoadBack(n);this._schedule();
   });
   root.addEventListener('change',e=>{
    const sel=e.target?.closest?.('[data-ehqt-back]');
    const n=sel&&Number(sel.value);
    if(n>=2&&n<=9)pick('back:'+n);
   });
  }
 };
 P._ehWxLoad=async function(){
  const c=this.config||{},h=this._hass,e=this._ehWx;
  if(!c.weather||!h?.states?.[c.weather])return;
  if(e&&(e.loading||Date.now()-e.at<(e.error?600000:1800000)))return;
  this._ehWx={loading:true,at:Date.now()};
  try{
   const daily=await ehWxFetch(h,c.weather,'daily');
   this._ehWx={loading:false,at:Date.now(),daily};
  }catch(err){
   this._ehWx={loading:false,at:Date.now(),error:String(err&&err.message?err.message:'Weersverwachting ophalen mislukt.')};
  }
  this._schedule();
 };
 P._ehWxBackLoad=async function(){
  const c=this.config||{},h=this._hass,e=this._ehWxBack;
  if(!c.weather||!h?.states?.[c.weather])return;
  if(e&&(e.loading||Date.now()-e.at<(e.error?600000:3600000)))return;
  this._ehWxBack={loading:true,at:Date.now()};
  try{this._ehWxBack={loading:false,at:Date.now(),res:await ehWxFetchBack(h,c,new Date())};}
  catch(err){this._ehWxBack={loading:false,at:Date.now(),error:String(err&&err.message?err.message:'Terugblik mislukt.')};}
  this._schedule();
 };
 P._ehQtLoadBack=async function(n){
  this._ehQtBack=this._ehQtBack||{};
  const e=this._ehQtBack[n];
  const dk=ehQtDayBounds(new Date(),-n).s;
  if(e&&(e.loading||(e.dk===dk&&Date.now()-e.at<1800000)))return;
  this._ehQtBack[n]={loading:true,at:Date.now(),dk};
  try{
   const r=await ehQtFetchBack(this._hass,this.config||{},n,new Date());
   this._ehQtBack[n]={loading:false,at:Date.now(),dk,res:r.res,bounds:r.bounds};
  }catch(err){
   this._ehQtBack[n]={loading:false,at:Date.now()-1500000,dk,error:String(err&&err.message?err.message:'Terugkijken is niet gelukt.')};
  }
  this._schedule();
 };
})();
