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
function ehQtChart(day,stats,nowMs,isToday){
 const W=360,H=150,X0=4,Y0=14,Y1=118,n=Math.max(day.expected,1),bw=(W-X0*2)/n;
 const lo=Math.min(0,stats.min.p),hi=Math.max(stats.max.p,lo+0.001),y=v=>Y1-((v-lo)/(hi-lo))*(Y1-Y0);
 const dayStart=day.slots.length?Math.floor(day.slots[0].t/86400000)*0:0;
 const first=day.start;
 let bars='',axis='';
 for(const s of day.slots){
  const i=Math.round((s.t-first)/EH_QT_STEP_MS),x=X0+i*bw,tier=ehQtTier(s.p,stats.min.p,stats.max.p);
  const yv=y(s.p),y0=y(0),top=Math.min(yv,y0),h=Math.max(1,Math.abs(yv-y0));
  const cur=isToday&&nowMs>=s.t&&nowMs<s.t+EH_QT_STEP_MS;
  bars+=`<rect class="ehqt-${tier}${cur?' ehqt-now':''}" x="${x.toFixed(2)}" y="${top.toFixed(1)}" width="${Math.max(0.6,bw-0.4).toFixed(2)}" height="${h.toFixed(1)}"><title>${ehEsc(ehQtTime(s.t)+' · '+ehQtPrice(s.p)+' per kWh')}</title></rect>`;
 }
 for(let i=0;i<n;i+=24){axis+=`<text x="${(X0+i*bw).toFixed(1)}" y="${H-8}">${ehEsc(ehQtTime(first+i*EH_QT_STEP_MS))}</text>`;}
 const nowLine=isToday&&nowMs>=first&&nowMs<first+n*EH_QT_STEP_MS?`<line class="ehqt-nowline" x1="${(X0+((nowMs-first)/EH_QT_STEP_MS)*bw).toFixed(1)}" x2="${(X0+((nowMs-first)/EH_QT_STEP_MS)*bw).toFixed(1)}" y1="${Y0-4}" y2="${Y1}"/>`:'';
 const label=`Prijs per kwartier: laagste ${ehQtPrice(stats.min.p)} om ${ehQtTime(stats.min.t)}, hoogste ${ehQtPrice(stats.max.p)} om ${ehQtTime(stats.max.t)}`;
 return `<div class="ehqt-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${ehEsc(label)}"><text class="ehqt-top" x="${X0}" y="9">${ehEsc(ehQtPrice(hi))} per kWh</text><line class="ehqt-base" x1="${X0}" x2="${W-X0}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>${bars}${nowLine}${axis}</svg></div>`;
}
function ehQtDayLabel(now,n){return new Date(now.getFullYear(),now.getMonth(),now.getDate()-n).toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'');}
function ehQtPills(sel,now){
 const one=[['today','Vandaag'],['tomorrow','Morgen'],['back:1','Gisteren']];
 const n=/^back:(\d+)$/.test(sel)?Number(sel.split(':')[1]):0;
 const opts=['<option value="">Eerder…</option>'].concat(Array.from({length:8},(_,i)=>i+2).map(d=>`<option value="${d}"${n===d?' selected':''}>${ehEsc(ehQtDayLabel(now,d))}</option>`)).join('');
 return `<div class="insight-periods ehqt-days" role="group" aria-label="Dag">${one.map(([id,l])=>`<button type="button" data-ehqt-day="${id}" aria-pressed="${sel===id}" class="${sel===id?'chosen':''}">${l}</button>`).join('')}<select data-ehqt-back aria-label="Eerdere dag" class="${n>=2?'chosen':''}">${opts}</select></div>`;
}
function ehQtHtml(card){
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
// ---- Terugkijken (tot circa 10 dagen terug: zo lang bewaart Home Assistant 5-minutenstatistiek en toestandsgeschiedenis) ----
function ehQtEur(v){return Number.isFinite(v)?(v<0?'−':'')+'€ '+ehFmt(Math.abs(v),2):'—';}
function ehQtCostChart(res,b){
 const W=360,H=150,X0=4,Y0=14,Y1=118,n=Math.max(res.expected,1),bw=(W-X0*2)/n;
 const vals=res.rows.map(r=>r.complete?(r.netto!==null?r.netto:r.afname):null);
 const known=vals.filter(v=>v!==null);
 if(!known.length)return '';
 const lo=Math.min(0,...known),hi=Math.max(0.001,...known),y=v=>Y1-((v-lo)/(hi-lo))*(Y1-Y0),y0=y(0);
 let bars='',axis='';
 res.rows.forEach((r,i)=>{
  const x=X0+i*bw,v=vals[i];
  if(v===null){bars+=`<rect class="ehqt-miss" x="${x.toFixed(2)}" y="${Y0}" width="${Math.max(0.6,bw-0.4).toFixed(2)}" height="${Y1-Y0}"><title>${ehEsc(ehQtTime(r.t)+': niet compleet')}</title></rect>`;return;}
  const yv=y(v),top=Math.min(yv,y0),h=Math.max(0.8,Math.abs(yv-y0));
  bars+=`<rect class="${v<0?'ehqt-low':'ehqt-high'}" x="${x.toFixed(2)}" y="${top.toFixed(1)}" width="${Math.max(0.6,bw-0.4).toFixed(2)}" height="${h.toFixed(1)}"><title>${ehEsc(ehQtTime(r.t)+' · '+ehQtEur(v))}</title></rect>`;
 });
 for(let i=0;i<n;i+=24)axis+=`<text x="${(X0+i*bw).toFixed(1)}" y="${H-8}">${ehEsc(ehQtTime(b.s+i*EH_QT_STEP_MS))}</text>`;
 const label='Kosten per kwartier: totaal '+(res.total.nettoKnown?ehQtEur(res.total.netto):ehQtEur(res.total.afname));
 return `<div class="ehqt-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${ehEsc(label)}"><text class="ehqt-top" x="${X0}" y="9">${ehEsc(ehQtEur(hi))} per kwartier</text><line class="ehqt-base" x1="${X0}" x2="${W-X0}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}"/>${bars}${axis}</svg></div>`;
}
function ehQtBackHtml(card,n,now){
 const pills=ehQtPills('back:'+n,now);
 const wrap=body=>`<section class="subsection ehqt" aria-label="Kwartierkosten terugkijken">${pills}${body}</section>`;
 const e=card._ehQtBack&&card._ehQtBack[n];
 if(!e||e.loading)return wrap('<div class="energy-loading">Kwartieren ophalen uit de geschiedenis…</div>');
 if(e.error)return wrap(`<p class="ehqt-warn">${ehEsc(e.error)}</p>`);
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
 const pid=c.kwartier_forecast||c.prijs;
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

function ehQtCss(){
 return [
  '/* EHQT KWARTIEREN */',
  '.ehqt-headline{font-size:15px;font-weight:800;margin:6px 0 10px}',
  '.ehqt-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:6px 0 12px}',
  '.ehqt-tile{background:#0b2132;border:1px solid #6d99b53d;border-radius:14px;padding:10px 9px;min-width:0}',
  '.ehqt-tile small{display:block;color:#a9c5d6;font-size:10px}.ehqt-tile strong{display:block;font-size:15px;margin:2px 0}.ehqt-tile span{display:block;color:#a9c5d6;font-size:10px}',
  '.ehqt-chart svg{display:block;width:100%;height:auto}.ehqt-chart text{fill:#9fbccd;font-size:9px;font-family:inherit}',
  '.ehqt-base{stroke:#6d99b53d;stroke-width:1}.ehqt-nowline{stroke:#fff;stroke-width:1.2;stroke-dasharray:2 2}',
  '.ehqt-low{fill:#38e8a1}.ehqt-mid{fill:#61b7ff}.ehqt-high{fill:#ffb48a}.ehqt-now{stroke:#fff;stroke-width:1}',
  '.ehqt-windows{margin-top:10px}.ehqt-windows>div{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline;justify-content:space-between}',
  '.ehqt-warn{margin:10px 0;padding:10px 12px;border-radius:12px;background:#3b2a0d;border:1px solid #ffca4455;color:#ffe2a1;font-size:12px;line-height:1.4}',
  '.ehqt-all summary{font-size:14px}.ehqt-all[open] summary{margin-bottom:6px}',
  '.ehqt-miss{fill:#143247;stroke:#6d99b544;stroke-dasharray:3 2}',
  '.ehqt-days select{appearance:none;border:1px solid #6d99b53d;background:#0b2132;color:#a9c5d6;border-radius:999px;padding:7px 11px;font:inherit;font-size:10px;font-weight:800;min-height:34px}.ehqt-days select.chosen{background:#0f4d45;border-color:#38e8a199;color:#eafff7}',
  '.ehqt-all{margin-top:12px}.ehqt-all summary{cursor:pointer;font-weight:800;min-height:44px;display:flex;align-items:center}',
  '.ehqt-all table{width:100%;border-collapse:collapse;font-size:12px}.ehqt-all th,.ehqt-all td{text-align:left;padding:5px 4px;border-bottom:1px solid #6d99b522}'
 ].join('\n');
}
(function ehQtInstall(){
 const P=EnergiehuisCard.prototype,previous=P._render;
 P._render=function(){
  previous.call(this);
  const root=this.shadowRoot;
  if(!root)return;
  const style=root.querySelector('style');
  if(style&&!style.textContent.includes('/* EHQT KWARTIEREN */'))style.textContent+='\n'+ehQtCss();
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
   root.addEventListener('change',e=>{
    const sel=e.target?.closest?.('[data-ehqt-back]');
    const n=sel&&Number(sel.value);
    if(n>=2&&n<=9)pick('back:'+n);
   });
  }
 };
 P._ehQtLoadBack=async function(n){
  this._ehQtBack=this._ehQtBack||{};
  const e=this._ehQtBack[n];
  if(e&&(e.loading||Date.now()-e.at<1800000))return;
  this._ehQtBack[n]={loading:true,at:Date.now()};
  try{
   const r=await ehQtFetchBack(this._hass,this.config||{},n,new Date());
   this._ehQtBack[n]={loading:false,at:Date.now(),res:r.res,bounds:r.bounds};
  }catch(err){
   this._ehQtBack[n]={loading:false,at:Date.now()-1500000,error:String(err&&err.message?err.message:'Terugkijken is niet gelukt.')};
  }
  this._schedule();
 };
})();
