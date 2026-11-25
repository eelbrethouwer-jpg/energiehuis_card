/* Energiehuis 3.0 — pagina "Balans": wie verbruikt wat, waar komt het vandaan en wat kost het.
 * Alle rekenregels staan in src/engines/balance-engine.cjs; dit bestand haalt uitsluitend data op en tekent.
 * Alleen lezen: geen servicecalls, geen opslagkeys, geen wijziging aan Alfen, loadbalancing of de beginpagina.
 */
const EH3_PERIODS=[['today','Vandaag'],['yesterday','Gisteren'],['7d','7 dagen'],['30d','30 dagen'],['year','Dit jaar']];
const EH3_HOUR=3600000;
const EH3_DIAG_DAYS=14;
const EH3_SKEW_DEFAULT_S=10; // gelijk aan de Live Cockpit (voorlopige waarde, nog niet gemeten in een echte HA)
const EH3_SOURCES=Object.freeze({
 p1:{label:'Net (P1)',cfg:'net',route:60,display:300},
 pv:{label:'Zonnepanelen',cfg:'zonnepanelen',route:90,display:2100},
 alfen:{label:'Cupra (Alfen)',cfg:'laden',route:90,display:2100},
 praktijk:{label:'Praktijkruimte',cfg:'praktijk',route:60,display:300}
});
const EH3_REASONS=Object.freeze({
 niet_consistent:'De bronnen sluiten niet op elkaar. Wacht op de volgende meting of controleer de meetlocatie.',
 niet_synchroon:'De bronnen lopen niet gelijk; er wordt geen schijnnauwkeurig getal getoond.',
 boven_aansluiting:'Hoger dan de aansluiting aankan (circa 9,2 kW): dit is een meetfout.',
 bron_ontbreekt:'Een bron ontbreekt of is niet actueel.'
});
const EH3_STATUS_TEXT=Object.freeze({gemeten:'Gemeten',berekend:'Berekend',geschat:'Geschat',verouderd:'Verouderd',onbeschikbaar:'Niet beschikbaar'});

function eh3Praktijk(c){return !!(c&&c.praktijk);}
function eh3PraktijkEnergy(c){return !!(c&&c.praktijk_energie);}
function eh3Sign(c){const s=c&&(c.p1_sign||c.live_cockpit_p1_sign);return s==='export_positive'?'export_positive':'import_positive';}
function eh3Kwh(n){return Number.isFinite(n)?ehFmt(n,Math.abs(n)>=100?0:1)+' kWh':'—';}
function eh3Pct(n){return Number.isFinite(n)?ehFmt(n*100,0)+'%':'—';}
function eh3Dot(status){
 const text=EH3_STATUS_TEXT[status]||'Onbekend';
 return `<i class="eh3-dot q-${ehEsc(status)}" role="img" aria-label="${ehEsc(text)}" title="${ehEsc(text)}"></i>`;
}
function eh3Factor(h,id,kind){
 const u=String(h?.states?.[id]?.attributes?.unit_of_measurement||'').trim().toLowerCase();
 if(kind==='energy')return u==='kwh'?1:u==='wh'?0.001:u==='mwh'?1000:null;
 return u==='w'?1:u==='kw'?1000:null;
}
function eh3Series(stats,h,id,kind,field){
 const f=id?eh3Factor(h,id,kind):null,rows=Array.isArray(stats?.[id])?stats[id]:[];
 if(f===null||!rows.length)return [];
 return rows.map(r=>({t:ehStatTime(r.start),change:Number.isFinite(r[field])?r[field]*f:null})).filter(r=>Number.isFinite(r.t));
}
function eh3PriceConvert(h,id,n){
 const u=String(h?.states?.[id]?.attributes?.unit_of_measurement||'').toLowerCase();
 if(!Number.isFinite(n))return null;
 if(u.includes('cent')||u.includes('ct/'))return n/100;
 return Math.abs(n)>10?n/10000000:n;
}
// Terugleververgoeding vanaf 2027: een getal (€/kWh) of een sensor. Nooit verzinnen.
function eh3Feedin(h,c){
 const raw=c&&c.terugleververgoeding;
 if(raw===undefined||raw===null||raw==='')return {q:null,source:null};
 if(typeof raw==='number'&&Number.isFinite(raw))return {q:raw,source:'config'};
 const s=String(raw).trim();
 if(h?.states?.[s]){
  const v=eh3PriceConvert(h,s,ehRead(h,s));
  return v===null?{q:null,source:'sensor'}:{q:v,source:'sensor'};
 }
 const n=ehNum(s);
 return n===null?{q:null,source:null}:{q:n,source:'config'};
}
function eh3Stamp(st){
 let best=NaN;
 for(const k of ['last_reported','last_updated','last_changed']){const v=Date.parse((st&&st[k])||'');if(Number.isFinite(v)&&!(v<=best))best=v;}
 return best;
}
// Eén live bron voor de vermogensbalans, met dezelfde versheidsregels als de Live Cockpit.
function eh3Source(h,id,spec,now){
 if(!id)return {w:null,status:'onbeschikbaar',t:null,reason:'niet_gekoppeld'};
 const st=h?.states?.[id];
 if(!st)return {w:null,status:'onbeschikbaar',t:null,reason:'niet_gevonden'};
 const raw=ehRead(h,id);
 if(raw===null)return {w:null,status:'onbeschikbaar',t:null,reason:'geen_waarde'};
 const w=ehW(h,id);
 if(w===null)return {w:null,status:'onbeschikbaar',t:null,reason:'onbekende_eenheid'};
 const t=eh3Stamp(st);
 if(!Number.isFinite(t))return {w,status:'verouderd',t:null,reason:'tijdstempel_onbekend'};
 const age=Math.max(0,now-t);
 return {w,status:age>spec.route*1000?'verouderd':'gemeten',t,ageS:age/1000};
}
function eh3Live(card,h,c){
 const now=Date.now(),src={};
 for(const k of Object.keys(EH3_SOURCES))src[k]=eh3Source(h,c[EH3_SOURCES[k].cfg],EH3_SOURCES[k],now);
 // Onthoud de laatste goede PV-waarde als nachtbewijs (alleen in dit geheugen, niet opgeslagen).
 if(src.pv.w!==null)card._eh3LastPv=src.pv.w;
 if(src.pv.status!=='gemeten'){
  const night=ehBalNightPv({w:null,status:'onbeschikbaar'},{belowHorizon:h?.states?.['sun.sun']?.state==='below_horizon',lastValidW:src.pv.w!==null?src.pv.w:(Number.isFinite(card._eh3LastPv)?card._eh3LastPv:(Number.isFinite(card._balDiag?.result?.lastPvW)?card._balDiag.result.lastPvW:null))});
  if(night.w===0)src.pv={w:0,status:'geschat',t:null,reason:'nacht'};
 }
 const skew=Number(c.balance_max_skew_s);
 const r=ehBalPower(src,{p1Sign:eh3Sign(c),praktijkConfigured:eh3Praktijk(c),maxSkewS:Number.isFinite(skew)&&skew>0?skew:EH3_SKEW_DEFAULT_S});
 r.src=src;
 return r;
}

// ---- Data ophalen (Recorder-langetermijnstatistiek per uur) ---------------------------------------
function eh3Limits(p,now){
 const lim=ehPeriodLimits(p,now),to=Math.min(lim.to.getTime(),now.getTime());
 return {from:Math.floor(lim.from.getTime()/EH3_HOUR)*EH3_HOUR,to:Math.floor(to/EH3_HOUR)*EH3_HOUR};
}
function eh3EnergyIds(c){
 return {imp:c.import,exp:c.export,pv:c.zonne_energie,alfen:c.laad_energie,praktijk:eh3PraktijkEnergy(c)?c.praktijk_energie:''};
}
const EH3_ENERGY_NAMES=Object.freeze({imp:'Net afname',exp:'Net teruglevering',pv:'Zonne-energie',alfen:'Laadenergie (Alfen)',praktijk:'Praktijk-energie'});

async function eh3Fetch(h,ids,fromMs,toMs,types){
 const list=[...new Set(ids.filter(Boolean))];
 if(!list.length||toMs<=fromMs)return {};
 return h.callWS({type:'recorder/statistics_during_period',start_time:new Date(fromMs).toISOString(),end_time:new Date(toMs).toISOString(),statistic_ids:list,period:'hour',types});
}
function eh3Hours(stats,h,c,fromMs,toMs){
 const ids=eh3EnergyIds(c),series={},missing=[];
 for(const k of Object.keys(ids)){
  series[k]=eh3Series(stats,h,ids[k],'energy','change');
  if(k==='praktijk'&&!ids[k])continue;
  if(!series[k].length){
   missing.push({key:k,name:EH3_ENERGY_NAMES[k],reason:!ids[k]?'niet gekoppeld':eh3Factor(h,ids[k],'energy')===null?'onbekende eenheid':'geen langetermijnstatistiek (state_class ontbreekt of nog geen data)'});
  }
 }
 return {hours:ehBalHours(series,fromMs,toMs),missing};
}
function eh3Prices(stats,h,c){
 const map=new Map(),fe=eh3Feedin(h,c);
 const rows=Array.isArray(stats?.[c.prijs])?stats[c.prijs]:[];
 for(const r of rows){
  const t=ehStatTime(r.start),p=eh3PriceConvert(h,c.prijs,r.mean);
  if(Number.isFinite(t)&&p!==null)map.set(Math.round(t/EH3_HOUR)*EH3_HOUR,{p,q:fe.q});
 }
 return {map,feedin:fe,rows:rows.length};
}
// Meetcontrole op de laatste twee weken: beantwoordt de open vragen uit de review met je eigen data.
function eh3Diagnose(stats,h,c,fromMs,toMs){
 const ids=eh3EnergyIds(c),pw=(id)=>eh3Series(stats,h,id,'power','mean');
 const en={};for(const k of Object.keys(ids))en[k]=eh3Series(stats,h,ids[k],'energy','change');
 const hours=ehBalHours(en,fromMs,toMs);
 const mapOf=a=>{const m=new Map();for(const r of a)m.set(Math.round(r.t/EH3_HOUR)*EH3_HOUR,r.change);return m;};
 const net=mapOf(pw(c.net)),pvp=mapOf(pw(c.zonnepanelen)),alp=mapOf(pw(c.laden)),prp=mapOf(eh3PraktijkEnergy(c)&&c.praktijk?pw(c.praktijk):[]);
 // Laatste geldige PV-uurwaarde vóór een uitval: bewijs voor "nacht" (alleen samen met zon onder de horizon).
 const pvRows=pw(c.zonnepanelen).filter(r=>Number.isFinite(r.change)),lastPv=pvRows.length?pvRows[pvRows.length-1]:null;
 const signRows=hours.map(x=>({meanW:net.has(x.t)?net.get(x.t):null,imp:x.imp,exp:x.exp}));
 const ratio=(m,key)=>ehBalRatioCheck(hours.map(x=>({meanW:m.has(x.t)?m.get(x.t):null,change:x[key]})));
 return {
  days:Math.round((toMs-fromMs)/(24*EH3_HOUR)),
  lastPvW:lastPv&&toMs-lastPv.t<=36*EH3_HOUR?lastPv.change:null,
  sign:ehBalSignCheck(signRows),
  pv:ratio(pvp,'pv'),alfen:ratio(alp,'alfen'),praktijk:eh3PraktijkEnergy(c)&&c.praktijk?ratio(prp,'praktijk'):null,
  closure:ehBalClosureCheck(hours,{praktijkConfigured:eh3PraktijkEnergy(c)})
 };
}

EnergiehuisCard.prototype._loadBalance=async function(){
 const h=this._hass,c=this.config;
 if(this._view!=='balance'||!h?.callWS||!c)return;
 const p=this._balPeriod||'today',now=new Date(),lim=eh3Limits(p,now);
 const ids=eh3EnergyIds(c),idList=Object.values(ids).filter(Boolean).concat(c.prijs?[c.prijs]:[]);
 const key=[p,lim.from,lim.to,idList.join(','),String(c.terugleververgoeding||'')].join('|');
 const ttl=p==='today'?5*60*1000:30*60*1000;
 if(this._balResult&&this._balResult.key===key&&Date.now()-this._balResult.fetched<ttl)return;
 if(this._balLoadingKey===key)return;
 this._balLoadingKey=key;
 let result;
 try{
  const stats=await eh3Fetch(h,idList,lim.from,lim.to,['change','mean']);
  const praktijkOn=eh3PraktijkEnergy(c);
  const built=eh3Hours(stats,h,c,lim.from,lim.to);
  const agg=ehBalAggregate(built.hours,{praktijkConfigured:praktijkOn,expected:built.hours.length});
  const price=eh3Prices(stats,h,c);
  const cost=ehBalCostAggregate(built.hours,price.map,{praktijkConfigured:praktijkOn,expected:built.hours.length});
  result={key,period:p,from:lim.from,to:lim.to,hours:built.hours.length,agg,cost,missing:built.missing,feedin:price.feedin,priceRows:price.rows,praktijkOn,error:null,fetched:Date.now()};
 }catch(_){
  result={key,period:p,from:lim.from,to:lim.to,hours:0,agg:null,cost:null,missing:[],feedin:eh3Feedin(h,c),priceRows:0,praktijkOn:eh3PraktijkEnergy(c),error:'Langetermijnstatistieken zijn niet beschikbaar. Controleer de Recorder-integratie en de entiteiten.',fetched:Date.now()};
 }
 if(this._balLoadingKey===key){this._balResult=result;this._balLoadingKey=null;this._schedule();}
 // Meetcontrole: laatste twee weken, hooguit eens per uur.
 const dkey=[idList.join(','),c.net,c.zonnepanelen,c.laden,c.praktijk||''].join('|'); // los van de periode: één keer per uur
 if(!this._balDiag||this._balDiag.key!==dkey||Date.now()-this._balDiag.fetched>EH3_HOUR){
  if(this._balDiagLoading===dkey)return;
  this._balDiagLoading=dkey;
  try{
   const to=Math.floor(Date.now()/EH3_HOUR)*EH3_HOUR,from=to-EH3_DIAG_DAYS*24*EH3_HOUR;
   const stats=await eh3Fetch(h,Object.values(ids).concat([c.net,c.zonnepanelen,c.laden,c.praktijk]),from,to,['change','mean']);
   this._balDiag={key:dkey,fetched:Date.now(),result:eh3Diagnose(stats,h,c,from,to),error:null};
  }catch(_){
   this._balDiag={key:dkey,fetched:Date.now(),result:null,error:'Meetcontrole niet beschikbaar: geen langetermijnstatistiek.'};
  }finally{this._balDiagLoading=null;this._schedule();}
 }
};

// ---- Weergave -------------------------------------------------------------------------------------
function eh3WoningText(r){
 const w=r.woning;
 if(w.w!==null)return {value:ehPower(w.w),sub:w.note==='meetruis'?'Meetruis, getoond als 0 W':(w.inclPraktijk?'Inclusief praktijkruimte (niet gekoppeld)':'Restpost: alles wat niet apart gemeten wordt'),status:w.status};
 let why=EH3_REASONS[w.reason]||EH3_REASONS.bron_ontbreekt;
 if(w.reason==='bron_ontbreekt'&&Array.isArray(w.missing)&&w.missing.length)why+=' ('+w.missing.map(k=>EH3_SOURCES[k]?.label||k).join(', ')+')';
 return {value:'—',sub:why,status:'onbeschikbaar'};
}
function eh3NowHtml(live){
 const row=(icon,label,w,status,sub,tone)=>`<div class="eh3-row"><span class="sub-icon ${tone}">${ehIcon(icon)}</span><span class="eh3-row-copy"><strong>${ehEsc(label)}</strong><small>${ehEsc(sub)}</small></span><span class="eh3-row-val">${ehEsc(w)}${w==='—'?'':eh3Dot(status)}</span></div>`;
 const wt=eh3WoningText(live);
 const net=live.net.w,dir=net===null?'Niet beschikbaar':net<-50?'Teruglevering':net>50?'Afname van het net':'In balans';
 const rows=[
  row('grid','Net',net===null?'—':ehPower(Math.abs(net)),live.net.status,dir,'blue'),
  row('sun','Zonnepanelen',live.pv.w===null?'—':ehPower(live.pv.w),live.pv.status,live.pv.reason==='nacht'?'Geschat: nacht, zon onder de horizon':'Huidige opwek (AC)','gold'),
  row('home','Woning',wt.value,wt.status,wt.sub,'peach'),
  live.praktijkConfigured?row('home','Praktijkruimte',live.praktijk.w===null?'—':ehPower(live.praktijk.w),live.praktijk.status,'Submeter','blue'):'',
  row('car','Cupra',live.cupra.w===null?'—':ehPower(live.cupra.w),live.cupra.status,live.cupra.w!==null&&live.cupra.w>80?'Aan het laden':'Laadt niet','mint')
 ].join('');
 let answer='Nog niet genoeg actuele metingen voor een totaalbeeld.';
 if(live.verbruik.w!==null&&live.eigenZon.w!==null&&live.net.importW!==null){
  answer=`Nu ${ehPower(live.verbruik.w)} verbruik · ${ehPower(live.eigenZon.w)} eigen zon · ${ehPower(live.net.importW)} van het net`+(live.net.exportW>50?` · ${ehPower(live.net.exportW)} terug`:'');
 }
 let close='';
 if(live.woning.w!==null&&live.net.w!==null&&live.pv.w!==null){
  const parts=[['Woning',live.woning.w],...(live.praktijkConfigured?[['Praktijk',live.praktijk.w]]:[]),['Cupra',live.cupra.w]];
  close=`<p class="eh3-close" aria-label="Controle: wat erin gaat komt eruit">${parts.map(([n,v])=>ehEsc(n)+' '+ehEsc(ehPower(v))).join(' + ')} = Net ${ehEsc(ehPower(live.net.w))} + Zon ${ehEsc(ehPower(live.pv.w))}</p>`;
 }
 return `<section class="eh3-card" aria-labelledby="eh3-now"><div class="section-title" id="eh3-now">${ehIcon('bolt')} Nu</div><p class="eh3-answer">${ehEsc(answer)}</p><div class="eh3-rows">${rows}</div>${close}</section>`;
}
function eh3CoverageHtml(r){
 const a=r.agg;
 if(!a)return '';
 if(!r.hours)return '<p class="eh3-warn">Nog geen volledig uur in deze periode.</p>';
 if(!a.partial)return `<p class="eh3-cov ok">Alle ${a.expected} uren zijn compleet.</p>`;
 return `<p class="eh3-cov partial">Minimaal: ${a.complete} van ${a.expected} uren zijn compleet (${ehFmt(a.coverage*100,0)}% dekking). Totalen zijn gedeeltelijk, niet aangevuld.</p>`;
}
function eh3UseHtml(r){
 const title=`<div class="section-title" id="eh3-use">${ehIcon('home')} Wie verbruikt wat</div>`;
 if(r.error)return `<section class="eh3-card" aria-labelledby="eh3-use">${title}<p class="plan-warning">${ehEsc(r.error)}</p></section>`;
 const a=r.agg,t=a.totals;
 const miss=r.missing.length?`<p class="eh3-warn">Geen statistiek voor: ${r.missing.map(m=>ehEsc(m.name)+' ('+ehEsc(m.reason)+')').join('; ')}. Die onderdelen ontbreken in de totalen.</p>`:'';
 let body;
 if(t.verbruik===null||a.woningReason){
  body=`<p class="eh3-warn">${a.woningReason?ehEsc(a.notes.join(' ')||EH3_REASONS.niet_consistent):'Geen volledige uren om het verbruik te berekenen.'}</p>`;
 }else{
  const parts=[['Woning',t.woning,'w'],...(r.praktijkOn?[['Praktijkruimte',t.praktijk,'p']]:[]),['Cupra',t.cupra,'c']];
  const sum=parts.reduce((s,x)=>s+(x[1]||0),0)||1;
  const bar=parts.map(([n,v,k])=>`<i class="eh3-seg s-${k}" style="width:${Math.max(0,(v||0)/sum*100).toFixed(1)}%" title="${ehEsc(n)}"></i>`).join('');
  const lines=parts.map(([n,v,k])=>`<div class="eh3-line"><span><i class="eh3-key s-${k}"></i>${ehEsc(n)}</span><strong>${ehEsc(eh3Kwh(v))}</strong><small>${ehEsc(eh3Pct((v||0)/sum))}</small></div>`).join('');
  const selfUse=t.pv?Math.min(1,Math.max(0,t.eigenZon/t.pv)):null,selfSuff=t.verbruik>0?Math.min(1,Math.max(0,t.eigenZon/t.verbruik)):null;
  body=`<p class="eh3-big">${ehEsc(eh3Kwh(t.verbruik))}<small> verbruikt${a.partial?' (minimaal)':''}</small></p>
   <div class="eh3-bar" role="img" aria-label="Verdeling van het verbruik">${bar}</div>${lines}
   <div class="eh3-metrics">
    <div><small>Zon opgewekt</small><strong>${ehEsc(eh3Kwh(t.pv))}</strong></div>
    <div><small>Direct zelf gebruikt</small><strong>${ehEsc(eh3Kwh(t.eigenZon))}</strong><span>${ehEsc(eh3Pct(selfUse))} van de opwek</span></div>
    <div><small>Teruggeleverd</small><strong>${ehEsc(eh3Kwh(t.export))}</strong></div>
    <div><small>Van het net</small><strong>${ehEsc(eh3Kwh(t.import))}</strong><span>${ehEsc(eh3Pct(selfSuff))} gedekt door eigen zon</span></div>
   </div>
   <p class="subtle">Woning is een restpost: alles wat niet apart gemeten wordt (warmtepomp, koken, standby) plus de meetfouten van de andere meters.${r.praktijkOn?'':' Praktijkruimte is niet gekoppeld; Woning bevat die dan.'}</p>`;
 }
 return `<section class="eh3-card" aria-labelledby="eh3-use">${title}${eh3CoverageHtml(r)}${body}${miss}</section>`;
}
function eh3CostHtml(r){
 const title=`<div class="section-title" id="eh3-cost">${ehIcon('euro')} Wat het kost</div>`;
 if(r.error||!r.cost)return `<section class="eh3-card" aria-labelledby="eh3-cost">${title}<p class="plan-warning">${ehEsc(r.error||'Geen kostendata.')}</p></section>`;
 const k=r.cost,regs=k.regimes.length?k.regimes:[ehBalRegime(r.to-1)],regime=regs.includes('vergoeding')?(regs.includes('saldering')?'beide':'vergoeding'):'saldering';
 const banner=regime==='saldering'
  ?'Tot en met 31 december 2026 geldt saldering: teruggeleverde kWh worden verrekend tegen de afnameprijs. Dit uurlijkse overzicht is een benadering; de echte afrekening volgt uit je jaarafrekening.'
  :regime==='vergoeding'
   ?'Vanaf 1 januari 2027 stopt saldering: elke teruggeleverde kWh wordt apart vergoed, tegen een lagere prijs dan je inkoopprijs.'
   :'Deze periode loopt over de einddatum van saldering (1 januari 2027): per uur wordt het juiste regime gebruikt.';
 let body;
 if(!k.used){
  const why=!r.priceRows?'Geen prijshistorie gevonden. Controleer of de prijssensor langetermijnstatistiek heeft (state_class: measurement).':'Geen uur met zowel volledige energiedata als prijs.';
  body=`<p class="eh3-warn">${ehEsc(why)}</p>`;
 }else{
  const qNote=!k.qComplete?`<p class="eh3-warn">Terugleververgoeding niet ingesteld voor ${k.qMissing} uur. Stel <code>terugleververgoeding</code> in (bijvoorbeeld <code>0.07</code> in €/kWh, of een sensor); tot dan tonen we alleen de afnamekosten en laten we netto en zonvoordeel weg.</p>`:'';
  const cons=[['Woning','woning'],...(r.praktijkOn?[['Praktijkruimte','praktijk']]:[]),['Cupra','cupra']];
  const keys=cons.map(x=>x[1]);
  const aParts=ehBalSplitCents(keys.map(x=>k.A[x]),k.A_total),bParts=ehBalSplitCents(keys.map(x=>k.netShare[x]),k.afnameKosten);
  const t=r.agg.totals;
  const kwhOf={woning:t.woning,praktijk:t.praktijk,cupra:t.cupra};
  const rows=cons.map(([n,key],i)=>`<tr><th scope="row">${ehEsc(n)}</th><td>${ehEsc(eh3Kwh(kwhOf[key]))}</td><td>${ehEsc(ehEuro2(aParts[i]))}</td><td>≈ ${ehEsc(ehEuro2(bParts[i]))}</td></tr>`).join('');
  const tiles=`<div class="eh3-tiles">
   <div><small>Zonder zon</small><strong>${ehEsc(ehEuro2(k.A_total))}</strong><span>Waarde van al je verbruik</span></div>
   <div><small>${k.qComplete?'Netto betaald':'Afname betaald'}</small><strong>${ehEsc(ehEuro2(k.qComplete?k.netKosten:k.afnameKosten))}</strong><span>${k.qComplete?'Afname minus teruglevering':'Excl. teruglevering'}</span></div>
   <div><small>Zon bespaarde</small><strong>${k.qComplete?ehEsc(ehEuro2(k.zonneImpact)):'—'}</strong><span>Eigen gebruik plus terugverdienen</span></div>
  </div>`;
  const eq=k.qComplete?`<p class="eh3-close">Netto = afname ${ehEsc(ehEuro2(k.afnameKosten))} − teruglevering ${ehEsc(ehEuro2(k.terugleverOpbrengst))} = ${ehEsc(ehEuro2(k.netKosten))}</p>`:'';
  body=`${tiles}${qNote}
   <div class="eh3-table-wrap"><table class="eh3-table"><thead><tr><th scope="col">Verbruiker</th><th scope="col">kWh</th><th scope="col">Waarde</th><th scope="col">Netkosten</th></tr></thead><tbody>${rows}</tbody></table></div>${eq}
   <p class="subtle"><strong>Gemeten:</strong> kWh en prijs. <strong>Verdeelsleutel (≈):</strong> hoeveel netkosten bij welke verbruiker horen. Achter één aansluiting mengt alle stroom, dus welke zonnestroom naar wie ging is boekhouding, geen meting. De bedragen tellen exact op tot het totaal.</p>`;
 }
 const cov=k.partial&&k.used?`<p class="eh3-cov partial">Kosten over ${k.used} van ${k.expected} uren${k.noPrice?` (${k.noPrice} zonder prijs)`:''}.</p>`:'';
 return `<section class="eh3-card" aria-labelledby="eh3-cost">${title}<p class="eh3-regime">${ehEsc(banner)}</p>${cov}${body}</section>`;
}
function eh3CheckHtml(card,c){
 const d=card._balDiag,title=`<div class="section-title" id="eh3-check">${ehIcon('shield')} Meetcontrole</div>`;
 if(!d)return `<section class="eh3-card" aria-labelledby="eh3-check">${title}<div class="energy-loading">Je eigen meetdata van de laatste twee weken controleren…</div></section>`;
 if(!d.result)return `<section class="eh3-card" aria-labelledby="eh3-check">${title}<p class="plan-warning">${ehEsc(d.error)}</p></section>`;
 const r=d.result,items=[];
 const item=(state,name,text)=>items.push(`<div class="eh3-check ${state}"><span class="eh3-pill">${state==='ok'?'In orde':state==='warn'?'Let op':'Onvoldoende data'}</span><div><strong>${ehEsc(name)}</strong><p>${ehEsc(text)}</p></div></div>`);
 const cfgSign=eh3Sign(c);
 if(r.sign.verdict==='onvoldoende_data')item('na','P1-teken','Te weinig uren met afname of teruglevering om het teken te beoordelen, of de P1-vermogenssensor heeft geen langetermijnstatistiek.');
 else if(r.sign.verdict==='onduidelijk')item('warn','P1-teken','Het vermogen en de tellers spreken elkaar tegen. Controleer de P1-sensor.');
 else if(r.sign.verdict===cfgSign)item('ok','P1-teken',r.sign.verdict==='import_positive'?'Klopt: positief vermogen betekent afname.':'Klopt met je instelling: positief vermogen betekent teruglevering (p1_sign: export_positive).');
 else item('warn','P1-teken',r.sign.verdict==='export_positive'?'Je P1-sensor lijkt positief bij teruglevering. Zet p1_sign: export_positive in de kaartconfiguratie, anders klopt Woning niet.':'Je kaart staat op export_positive, maar de P1-sensor is positief bij afname. Haal p1_sign weg of zet hem op import_positive.');
 const ratioItem=(name,x,hint)=>{
  if(!x)return;
  if(x.verdict==='onvoldoende_data')item('na',name,'Te weinig meeturen of geen langetermijnstatistiek voor het vermogen.');
  else if(x.verdict==='ok')item('ok',name,`Vermogen en teller komen overeen (${ehFmt(x.ratio*100,1)}%).`);
  else if(x.verdict==='vermogen_hoger')item('warn',name,`Het vermogen ligt ${ehFmt((x.ratio-1)*100,1)}% boven de teller. ${hint}`);
  else if(x.verdict==='vermogen_lager')item('warn',name,`Het vermogen ligt ${ehFmt((1-x.ratio)*100,1)}% onder de teller. Controleer eenheden en meetmoment.`);
  else item('warn',name,`Vermogen en teller wijken ${ehFmt(Math.abs(x.ratio-1)*100,0)}% af. Controleer of het dezelfde meting is.`);
 };
 ratioItem('Zonnepanelen (AC of DC)',r.pv,'Waarschijnlijk meet de sensor DC-vermogen (voor de omvormer): Woning is bij zon dan structureel te hoog. Zoek in Home Assistant een AC-uitgangsvermogen.');
 ratioItem('Cupra (Alfen)',r.alfen,'Dit kan een andere meetbasis zijn (bijvoorbeeld inclusief verliezen).');
 if(r.praktijk)ratioItem('Praktijkruimte',r.praktijk,'Controleer of de meter echt achter de hoofdmeter hangt.');
 const cl=r.closure;
 if(cl.verdict==='onvoldoende_data')item('na','Sluiting uurbalans','Te weinig complete uren om te beoordelen (zijn alle tellers gekoppeld?).');
 else if(cl.verdict==='ok')item('ok','Sluiting uurbalans',`Woning komt in ${cl.negative} van ${cl.n} uren negatief uit: de bronnen sluiten op elkaar.`);
 else item('warn','Sluiting uurbalans',`Woning komt in ${cl.negative} van ${cl.n} uren duidelijk negatief uit (laagste ${ehFmt(cl.worstKwh,2)} kWh). Controleer de meetlocatie van Praktijk en Alfen en de teller-eenheden.`);
 return `<section class="eh3-card" aria-labelledby="eh3-check">${title}<p class="subtle">Gebaseerd op je eigen uurdata van de laatste ${r.days} dagen. Dit is een indicatie, geen bewijs: controleer een waarschuwing altijd in Home Assistant.</p>${items.join('')}</section>`;
}
EnergiehuisCard.prototype._balanceHtml=function(h,c){
 const live=eh3Live(this,h,c);
 const p=this._balPeriod||'today',r=this._balResult&&this._balResult.period===p?this._balResult:null;
 const periods=`<div class="insight-periods eh3-periods" role="group" aria-label="Periode">${EH3_PERIODS.map(([id,label])=>`<button type="button" data-eh3-period="${id}" aria-pressed="${p===id}" class="${p===id?'chosen':''}">${label}</button>`).join('')}</div>`;
 const loading=`<section class="eh3-card"><div class="energy-loading">Uren ophalen uit de langetermijnstatistiek…</div></section>`;
 const worst=[live.woning.status,live.net.status,live.pv.status].reduce((a,b)=>EH_BAL_STATUS.indexOf(b)>EH_BAL_STATUS.indexOf(a)?b:a,'gemeten');
 return `<main class="subpage eh3">
  <div class="subpage-head"><div><div class="eyebrow">Energiebalans</div><h2>Balans</h2><p>Waar gaat je stroom heen, waar komt hij vandaan en wat kost het. Alles uit je eigen meters, met erbij hoe zeker elk getal is.</p></div><div class="quality-pill"><small>Live meetkwaliteit</small><strong>${ehEsc(EH3_STATUS_TEXT[live.woning.w!==null?live.woning.status:worst]||'—')}</strong></div></div>
  ${eh3NowHtml(live)}
  ${periods}
  ${r?eh3UseHtml(r)+eh3CostHtml(r):loading}
  ${eh3CheckHtml(this,c)}
  <p class="subtle eh3-foot">Gemeten = rechtstreeks uit een sensor. Berekend = uit gemeten bronnen. Geschat = met een aanname (bijvoorbeeld nacht). Verouderd en niet beschikbaar tellen nooit mee als 0.</p>
 </main>`;
};

// ---- Stijl en koppeling met de kaart ---------------------------------------------------------------
function eh3Css(){
 return `/* EH3 BALANS */
.eh3 .eh3-card{margin:0 0 14px;padding:16px;border-radius:18px;background:#0b2132;border:1px solid #6d99b53d}
.eh3 .eh3-answer{margin:2px 0 12px;font-size:15px;font-weight:750;line-height:1.4}
.eh3 .eh3-rows{display:grid;gap:8px}
.eh3 .eh3-row{display:grid;grid-template-columns:38px 1fr auto;gap:11px;align-items:center;padding:9px 10px;border-radius:13px;background:#102636;border:1px solid #6d99b522}
.eh3 .eh3-row-copy{display:grid;min-width:0}
.eh3 .eh3-row-copy strong{font-size:13px}
.eh3 .eh3-row-copy small{color:#9fbccd;font-size:11px;line-height:1.35}
.eh3 .eh3-row-val{display:flex;align-items:center;gap:8px;font-size:19px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.eh3 .eh3-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:transparent;border:2px solid transparent;flex:none}
.eh3 .eh3-dot.q-geschat{background:#ffca44;border-color:#ffca44}
.eh3 .eh3-dot.q-verouderd{background:#7d8d99;border-color:#7d8d99}
.eh3 .eh3-dot.q-onbeschikbaar{border-color:#ff8a7a;background:transparent;width:11px;height:3px;border-radius:2px;border-width:0;background:#ff8a7a}
.eh3 .eh3-dot.q-berekend{border-color:#38e8a166}
.eh3 .eh3-close{margin:12px 0 0;font-size:11px;color:#a9c5d6;font-variant-numeric:tabular-nums}
.eh3 .eh3-periods{margin:2px 0 14px}
.eh3 .eh3-periods button{min-height:36px}
.eh3 .eh3-big{margin:4px 0 10px;font-size:30px;font-weight:850;letter-spacing:-.6px}
.eh3 .eh3-big small{font-size:13px;font-weight:650;color:#a9c5d6;letter-spacing:0}
.eh3 .eh3-bar{display:flex;height:14px;border-radius:99px;overflow:hidden;background:#143247;margin-bottom:12px}
.eh3 .eh3-seg.s-w,.eh3 .eh3-key.s-w{background:#ffb48a}
.eh3 .eh3-seg.s-p,.eh3 .eh3-key.s-p{background:#61b7ff}
.eh3 .eh3-seg.s-c,.eh3 .eh3-key.s-c{background:#38e8a1}
.eh3 .eh3-key{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:8px}
.eh3 .eh3-line{display:grid;grid-template-columns:1fr auto 52px;gap:10px;align-items:center;padding:7px 0;border-top:1px solid #6d99b51f;font-size:13px}
.eh3 .eh3-line small{text-align:right;color:#9fbccd}
.eh3 .eh3-metrics,.eh3 .eh3-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:14px 0 8px}
.eh3 .eh3-tiles{grid-template-columns:repeat(3,minmax(0,1fr))}
.eh3 .eh3-metrics>div,.eh3 .eh3-tiles>div{padding:10px 11px;border-radius:13px;background:#102636;border:1px solid #6d99b522;min-width:0}
.eh3 .eh3-metrics small,.eh3 .eh3-tiles small{display:block;color:#9fbccd;font-size:10px}
.eh3 .eh3-metrics strong,.eh3 .eh3-tiles strong{display:block;margin-top:3px;font-size:16px;font-variant-numeric:tabular-nums}
.eh3 .eh3-metrics span,.eh3 .eh3-tiles span{display:block;margin-top:2px;color:#8fb0c3;font-size:10px;line-height:1.3}
.eh3 .eh3-regime{margin:2px 0 10px;font-size:12px;color:#c5d9e6;line-height:1.5}
.eh3 .eh3-warn{margin:8px 0;padding:9px 11px;border-radius:11px;background:#3a2c0f;border:1px solid #ffca4455;color:#ffe2a0;font-size:12px;line-height:1.45}
.eh3 .eh3-cov{margin:0 0 8px;font-size:11px;color:#9fbccd}
.eh3 .eh3-cov.partial{color:#ffe2a0}
.eh3 .eh3-table-wrap{overflow-x:auto;margin-top:6px}
.eh3 .eh3-table{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}
.eh3 .eh3-table th,.eh3 .eh3-table td{padding:8px 6px;text-align:right;border-top:1px solid #6d99b51f;white-space:nowrap}
.eh3 .eh3-table th:first-child{text-align:left}
.eh3 .eh3-table thead th{color:#9fbccd;font-size:10px;font-weight:650;border-top:0}
.eh3 .eh3-check{display:grid;grid-template-columns:96px 1fr;gap:11px;padding:10px 0;border-top:1px solid #6d99b51f}
.eh3 .eh3-check p{margin:3px 0 0;color:#b5cddb;font-size:12px;line-height:1.45}
.eh3 .eh3-pill{align-self:start;text-align:center;padding:5px 7px;border-radius:99px;font-size:10px;font-weight:800;background:#102636;border:1px solid #6d99b53d;color:#a9c5d6}
.eh3 .eh3-check.ok .eh3-pill{background:#0f3a2d;border-color:#38e8a166;color:#aef5d6}
.eh3 .eh3-check.warn .eh3-pill{background:#3a2c0f;border-color:#ffca4466;color:#ffe2a0}
.eh3 .eh3-foot{margin-top:6px}
.eh3 code{font-size:11px;background:#0f2a3b;padding:1px 5px;border-radius:5px}
@media(max-width:720px){.eh3 .eh3-tiles{gap:6px}.eh3 .eh3-tiles>div{padding:9px 8px}.eh3 .eh3-tiles strong{font-size:15px}.eh3 .eh3-tiles span{display:none}.eh3 .eh3-check{grid-template-columns:1fr}.eh3 .eh3-pill{justify-self:start}.eh3 .eh3-row-val{font-size:17px}.eh3 .eh3-big{font-size:26px}}
@media(min-width:960px){.eh3 .eh3-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}}`;
}
(function eh3Install(){
 const P=EnergiehuisCard.prototype,previous=P._render;
 P._render=function(){
  previous.call(this);
  if(!this.config||!this._hass||this._view!=='balance')return;
  const root=this.shadowRoot,style=root?.querySelector?.('style');
  if(style&&!style.textContent.includes('/* EH3 BALANS'))style.textContent+='\n'+eh3Css();
  if(!this._eh3Events&&root){
   this._eh3Events=true;
   root.addEventListener('click',e=>{
    const b=e.target?.closest?.('[data-eh3-period]');
    if(!b)return;
    const next=b.dataset.eh3Period;
    if(!EH3_PERIODS.some(x=>x[0]===next))return;
    this._balPeriod=next;this._balResult=null;this._schedule();this._loadBalance();
   });
  }
  // Data ophalen zodra de pagina zichtbaar is en wanneer het resultaat verouderd is (idempotent per sleutel).
  const p=this._balPeriod||'today',ttl=p==='today'?5*60*1000:30*60*1000;
  if(!this._balLoadingKey&&(!this._balResult||this._balResult.period!==p||Date.now()-this._balResult.fetched>ttl))this._loadBalance();
 };
})();
