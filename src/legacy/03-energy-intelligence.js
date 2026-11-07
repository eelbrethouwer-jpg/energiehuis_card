/* v1.7.0 Smart Energy Intelligence: read-only analytics + confirmed helper-only baselines. */
function eh17N(v){if(v===null||v===undefined||v==="")return null;const n=typeof v==="number"?v:Number(String(v).replace(",","."));return Number.isFinite(n)?n:null;}

function eh17Hash(s){let h=0;for(const c of String(s||""))h=(h*31+c.charCodeAt(0))%65521;return h;}

function eh17Solar(h,id){
 const a=h?.states?.[id]?.attributes||{},raw=a.forecast??a.hourly??a.data??[];
 if(!Array.isArray(raw))return [];
 return raw.map(o=>{const t=Date.parse(o?.start??o?.start_date??o?.datetime??o?.time??"");const n=eh17N(o?.pv_kw??o?.power_kw??o?.estimated_power_kw??o?.estimate_kw);return {t,pv:n};}).filter(o=>Number.isFinite(o.t)&&o.pv!==null&&o.pv>=0&&o.pv<=30);
}

// Session energy is measured at the charger. The median describes observed average
// session power, including tapering/pauses; it is not the charger's maximum rating.
function eh23ChargePowerSuggestion(sessions,{minKwh=5,minMinutes=30,minSessions=3}={}){
 if(!Array.isArray(sessions)||!Number.isFinite(minKwh)||minKwh<=0||!Number.isFinite(minMinutes)||minMinutes<=0||!Number.isInteger(minSessions)||minSessions<1)return null;
 const powers=[];
 for(const session of sessions){
  if(!session||session.estimated)continue;
  const kwh=eh17N(session.kwh),start=eh17N(session.start),end=eh17N(session.end);
  if(kwh===null||kwh<minKwh||start===null||end===null||end<=start)continue;
  const minutes=(end-start)/60000;
  if(minutes<minMinutes)continue;
  const kw=kwh/(minutes/60);
  if(Number.isFinite(kw)&&kw>0)powers.push(kw);
 }
 if(powers.length<minSessions)return null;
 powers.sort((a,b)=>a-b);
 const middle=Math.floor(powers.length/2);
 return {kw:powers.length%2?powers[middle]:(powers[middle-1]+powers[middle])/2,count:powers.length};
}
// v1.24.2 reviewkandidaat: meetkwaliteit uitsluitend voor de laadscenario's.
// Onbetrouwbare sensoren worden niet als actuele meetwaarde gepresenteerd.
function eh24ChargeReading(h,id,{now=Date.now(),maxAgeMs=10*60*1000}={}){
 const sensor=h?.states?.[id];
 if(!sensor)return {watts:null,quality:'missing'};
 const watts=ehW(h,id);
 if(watts===null||!Number.isFinite(watts))return {watts:null,quality:'invalid'};
 if(watts<0)return {watts:null,quality:'negative'};
 const updated=Date.parse(sensor.last_updated||sensor.last_changed||'');
 if(!Number.isFinite(updated))return {watts:null,quality:'undated'};
 if(updated>now+60*1000)return {watts:null,quality:'future'};
 if(now-updated>maxAgeMs)return {watts:null,quality:'stale'};
 return {watts,quality:'measured'};
}
function eh24ChargeLimit(opts={}){
 // Houd deze zuivere UI-berekening aantoonbaar gelijk aan eh17Plan.
 // De regressietest vergelijkt op een raster met de echte planneruitkomst.
 const fuse=eh17N(opts.fuseAmp)??40,charger=eh17N(opts.chargerAmp)??32,reserve=eh17N(opts.reserveAmp)??2;
 const house=eh17N(opts.houseW),houseKnown=house!==null;
 const valid=fuse>0&&charger>=6&&reserve>=0&&reserve<fuse;
 const maxAmp=valid?Math.min(charger,fuse-reserve-Math.max(0,house??2000)/230):null;
 return {valid,houseKnown,maxKw:maxAmp===null?null:Math.max(0,maxAmp)*230/1000};
}
function eh24QualityLabel(quality,subject){
 const reason={
  missing:'ontbreekt',invalid:'heeft geen geldige waarde of eenheid',negative:'is negatief',
  undated:'heeft geen betrouwbaar meettijdstip',future:'heeft een tijdstip in de toekomst',
  stale:'is verouderd'
 }[quality];
 return reason?subject+' '+reason:'';
}
function eh23ChargePowerHtml(card,h,c,prices,need,opts={}){
 const result=card._eh17Sessions;
 if(card.isConnected&&!card._eh17SessionsLoading&&(!result||Date.now()-result.at>15*60000))card._eh17LoadSessions();
 const alfen=eh24ChargeReading(h,c.laden,{maxAgeMs:2*60*1000});
 const measured=alfen.watts,current=measured!==null&&measured>=1400?measured/1000:null;
 const history=eh23ChargePowerSuggestion(result?.error?[]:result?.sessions);
 // Planonafhankelijke grens; pariteit met eh17Plan wordt apart getest.
 const {valid:validLimits,houseKnown,maxKw}=eh24ChargeLimit(opts);
 let hasUsable=false,capped=false;
 const choice=(kind,title,kw,count)=>{
  const usable=Number.isFinite(kw)&&kw>=1.4;
  const input=usable?Math.min(7.4,Number(kw.toFixed(2))):null;
  if(usable){
   hasUsable=true;
   if(maxKw!==null&&maxKw>=1.38&&maxKw<input-.005)capped=true;
  }
  const selected=usable&&card._eh24PowerChoice===kind&&Math.abs((card._simPower??-1)-input)<.005;
  return '<button type="button" class="eh23-power-choice'+(selected?' is-selected':'')+'" data-eh23-power="'+kind+'" aria-pressed="'+(selected?'true':'false')+'" '+(!usable?'disabled':'')+'><span>'+title+'</span><strong>'+(usable?ehFmt(kw,2)+' kW':kind==='current'?'Geen actieve laadmeting':'Onder 1,4 kW')+'</strong>'+(count?'<small>Mediaan uit '+count+' geschikte sessies</small>':'')+(selected?'<small>Gekozen voor simulatie</small>':'')+'</button>';
 };
 const choices=choice('current','Huidig laadvermogen',current)+
  (history?choice('history','Gemiddeld sessievermogen',history.kw,history.count):'');
 const limitNote=!hasUsable?'':!validLimits?'Controleer de ingestelde veiligheidsgrenzen.':
  maxKw<1.38?'Minder dan 6 A beschikbaar bij de gebruikte huisbelasting.':
  capped?'Aansluitgrens: '+ehFmt(maxKw,2)+' kW. Hogere keuzes rekent de simulatie tot dit vermogen.':
  'Aansluitgrens: '+ehFmt(maxKw,2)+' kW.';
 const houseQuality=opts.houseQuality??(houseKnown?'measured':'missing');
 const houseNote=houseKnown?'':houseQuality==='stale'?' Huisbelasting verouderd (aanname 2000 W).':
  houseQuality==='negative'?' Huisbelasting negatief; niet gebruikt (aanname 2000 W).':
  houseQuality==='undated'?' Huisbelasting zonder betrouwbaar meettijdstip (aanname 2000 W).':
  houseQuality==='future'?' Huisbelasting met toekomstig meettijdstip (aanname 2000 W).':
  ' Huisbelasting onbekend (aanname 2000 W).';
 const alfenQuality=eh24QualityLabel(alfen.quality,'Alfen-meting');
 const warning=alfenQuality?'<p class="subtle eh24-meter-warning" role="status">'+ehEsc(alfenQuality+'. Actueel laadvermogen niet als keuze beschikbaar.')+'</p>':'';
 return '<div class="eh23-power-suggestions" aria-label="Laadvermogen kiezen">'+choices+
  (limitNote?'<p class="subtle eh23-power-limit">'+ehEsc(limitNote+houseNote+' Simulatiegrens; Alfen Active Load Balancing bepaalt het werkelijke vermogen.')+'</p>':'')+warning+
  '<p class="subtle">Kies zelf een gemeten waarde voor deze simulatie. Handmatige invoer blijft staan totdat je een knop kiest. Het actuele Alfen-vermogen is een momentopname; de sessiemediaan omvat ook langzamer laden en pauzes.</p></div>';
}
function eh17Plan(prices,now,departure,needKwh,requestedKw,mode,opts={}){
 const end=Date.parse(departure),start=now.getTime(),need=eh17N(needKwh),requested=eh17N(requestedKw);
 const empty=(error)=>({error,selected:[],totalKwh:0,remaining:Math.max(0,need||0),cost:null,mode});
 if(!Number.isFinite(end)||end<=start)return empty("Kies een toekomstige vertrektijd.");
 if(need===null||need<=0||need>100||requested===null||requested<=0)return empty("Controleer de gewenste laadbehoefte en het vermogen.");
 if(mode==="pause")return {...empty(null),remaining:need,cost:0};
 const fuse=eh17N(opts.fuseAmp)??40,charger=eh17N(opts.chargerAmp)??32;
 const reserve=eh17N(opts.reserveAmp)??2,house=eh17N(opts.houseW);
 const efficiency=Math.min(1,Math.max(.5,eh17N(opts.efficiency)??.9));
 if(fuse<=0||charger<6||reserve<0||reserve>=fuse)return empty("Controleer de ingestelde veiligheidsgrenzen.");
 const maxAmp=Math.min(charger,fuse-reserve-Math.max(0,house??2000)/230);
 const allowedKw=Math.min(requested,Math.max(0,maxAmp)*230/1000);
 if(allowedKw<1.38)return empty("Minder dan 6 A beschikbaar bij de gebruikte huisbelasting.");
 const solar=new Map((opts.solar||[]).map(v=>[v.t,v.pv]));
 const hourly=new Map();
 for(const v of prices||[]){
   const t=Date.parse(v?.t),p=eh17N(v?.p);
   if(!Number.isFinite(t)||t%3600000!==0||t+3600000<=start||t>=end||p===null)continue;
   // The numeric range cannot prove a unit; never silently convert apparent cent prices.
   if(p < -1 || p > 5)return empty("Controleer de prijseenheid: verwacht €/kWh tussen -1 en 5. Mogelijk zijn cent/kWh aangeleverd; er is niets omgerekend.");
   hourly.set(t,p);
 }
 const slots=[];
 for(let t=Math.floor(start/3600000)*3600000;t<end&&slots.length<72;t+=3600000){
   if(!hourly.has(t))continue;
   const slotStart=Math.max(start,t),slotEnd=Math.min(end,t+3600000);
   const hours=(slotEnd-slotStart)/3600000;
   const pv=solar.get(t);
   const surplus=Number.isFinite(pv)?Math.max(0,pv-Math.max(0,house??2000)/1000):null;
   const wallKw=mode==="sun"?(surplus===null?0:Math.min(allowedKw,surplus)):allowedKw;
   if(wallKw<1.38)continue;
   slots.push({t,slotStart,slotEnd,price:hourly.get(t),capacity:hours*wallKw*efficiency,wallKw,surplus});
 }
 if(!slots.length)return empty(mode==="sun"?"Geen tijdvakken met voldoende voorspeld zonne-overschot. Koppel eerst een betrouwbare PV-prognose.":"Geen tijdvakken met geldige tarieven vóór vertrek.");
 slots.sort((a,b)=>mode==="direct"?a.t-b.t:mode==="sun"?(b.surplus-a.surplus||a.t-b.t):(a.price-b.price||a.t-b.t));
 let remaining=need,cost=0;const selected=[];
 for(const slot of slots){
   if(remaining<=.00001)break;
   const kWh=Math.min(remaining,slot.capacity),wallKwh=kWh/efficiency;
   const sell=eh17N(opts.exportCompensation);
   const itemCost=mode==="sun"?(sell===null?null:wallKwh*sell):wallKwh*slot.price;
   selected.push({...slot,kWh,wallKwh,cost:itemCost});
   if(itemCost===null)cost=null;else if(cost!==null)cost+=itemCost;
   remaining-=kWh;
 }
 selected.sort((a,b)=>a.t-b.t);
 return {error:null,selected,totalKwh:need-remaining,remaining:Math.max(0,remaining),cost,allowedKw,houseKnown:house!==null,efficiency,mode};
}

function eh17Health(h,c,now=Date.now()){
 const defs=[["P1",c.net,5,"power"],["GoodWe",c.zonnepanelen,35,"power"],["Alfen",c.laden,35,"power"],["Cupra",c.cupra,50,"number"],["Zonneplan",c.prijs,95,"number"],["Virtuele batterij",c.battery_soc||c.batterij,140,"number"]];
 return defs.map(([name,id,mins,kind])=>{
   const st=id?h?.states?.[id]:null,raw=String(st?.state??""),n=eh17N(raw),unit=String(st?.attributes?.unit_of_measurement||"").toLowerCase();
   const updated=Date.parse(st?.last_updated??st?.last_changed??"");
   let status=!id||!st?"Ontbreekt":n===null?"Geen getal":kind==="power"&&!["w","kw"].includes(unit)?"Eenheid controleren":Number.isFinite(updated)&&now-updated>mins*60000?"Mogelijk verouderd":"Actueel";
   if(name==="GoodWe"&&status==="Mogelijk verouderd")status="Controleer daglicht";
   return {name,id,status,updated};
 });
}

function eh17Coach(h,c){
 const now=new Date(),t=ehPricesForDay(h,c,now),prices=ehHourlyFromPrices(t.quarters,t.hourly.length?t.hourly:ehForecast(h,c.prijs));
 const upcoming=prices.filter(p=>{const ms=Date.parse(p.t);return Number.isFinite(ms)&&ms>=Math.ceil(now.getTime()/3600000)*3600000&&ms<now.getTime()+36*3600000;}).sort((a,b)=>a.p-b.p);
 const first=upcoming[0],current=ehCurrentPrice(h,c.prijs),pv=ehW(h,c.zonnepanelen);
 const advice=[];
 if(first)advice.push(`<div><strong>Goedkoop volgend volledig uur</strong><p>${ehEsc(new Date(first.t).toLocaleString("nl-NL",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}))} · ${ehEsc(ehEuro2(first.p))}/kWh.${current===null?"":` Verschil met nu: ${ehEsc(ehEuro2(current-first.p))}/kWh.`}</p></div>`);
 if(!first)advice.push("<div><strong>Laadadvies ontbreekt</strong><p>De Zonneplan-forecast bevat nog geen volledige toekomstige uren.</p></div>");
 if(pv!==null&&pv>800)advice.push(`<div><strong>Zonnepanelen leveren</strong><p>Actueel ${ehEsc(ehPower(pv))}. Dit is geen voorspelling van het beschikbare overschot.</p></div>`);
 advice.push("<div><strong>Volgende stap</strong><p>Vergelijk Direct, Slim en Zon in het tabblad Slim laden. De voorstellen blijven simulaties.</p></div>");
 return `<section class="eh17-panel"><div class="eh17-title">${ehIcon("leaf")} Slimme energiecoach <span class="eh17-tag">Advies · geen sturing</span></div><div class="eh17-grid">${advice.join("")}</div></section>`;
}

function eh17Charge(h,c,card){
 const now=new Date(),soc=ehRead(h,c.cupra),capacity=eh17N(c.cupra_usable_kwh)||59;
 const need=card._simNeed??(soc!==null?Math.max(0,(card._targetSoc-soc)/100*capacity):eh17N(c.sim_laadbehoefte_kwh)||30);
 const kw=card._simPower??eh17N(c.sim_laadvermogen_kw)??3.7;
 const tr=ehPricesForDay(h,c,now),prices=ehHourlyFromPrices(tr.quarters,tr.hourly.length?tr.hourly:ehForecast(h,c.prijs));
 const house=ehW(h,c.huis),opts={fuseAmp:eh17N(c.fuse_amp)??40,chargerAmp:eh17N(c.charger_amp)??32,reserveAmp:eh17N(c.reserve_amp)??2,houseW:house,efficiency:eh17N(c.ev_charge_efficiency)??.9,solar:eh17Solar(h,c.pv_forecast),exportCompensation:eh17N(c.export_compensation_eur_kwh)};
 const sims=["direct","slim","sun"].map(m=>[m,eh17Plan(prices,now,card._departure,need,kw,m,opts)]);
 const slim=sims[1][1],direct=sims[0][1];
 const diff=slim.cost!==null&&direct.cost!==null&&slim.remaining<=.05&&direct.remaining<=.05?direct.cost-slim.cost:null;
 const markup=sims.map(([mode,p])=>`<div class="eh17-option"><small>${mode==="direct"?"Direct":mode==="slim"?"Slim":"Zonneladen"}</small><strong>${p.cost===null?"—":ehEuro2(p.cost)}</strong><span>${p.error?(mode==="sun"&&!opts.solar.length?"PV-prognose ontbreekt":ehEsc(p.error)):`${ehFmt(p.totalKwh,1)} van ${ehFmt(need,1)} kWh · tijdvakken: ${ehFmt(p.selected.reduce((sum,s)=>sum+(s.slotEnd-s.slotStart)/3600000,0),1)} uur`}</span>${p.remaining>.05?`<em>Nog ${ehFmt(p.remaining,1)} kWh te laden</em>`:""}</div>`).join("");
 const source=house===null?"Huisbelasting aangenomen: 2.000 W (geen actuele meting).":`Huisbelasting aangenomen constant: ${ehFmt(house/1000,2)} kW (huidige meting).`;
 return `<section class="cupra-card eh17-panel"><div class="eh17-title">${ehIcon("chart")} Laadverwachting</div><details class="eh32-model"><summary>Berekening en aannames</summary><p class="subtle">Voorzien van eenfase-grenzen; begin- en einddeeluren tellen naar rato mee. Het rekenmodel houdt rekening met ${ehFmt(opts.fuseAmp,0)}A hoofdaansluiting, maximaal ${ehFmt(opts.chargerAmp,0)}A voor de lader, ${ehFmt(opts.reserveAmp,0)}A reserve en ${ehFmt(opts.efficiency*100,0)}% aangenomen efficiëntie.</p></details><div class="eh17-options">${markup}</div><p class="eh23-window-note">Tijdvakken zijn beschikbare laadperiodes; het laatste kan deels worden gebruikt. Dit is geen berekende actieve laadtijd.</p>${diff===null?"":`<p class="eh17-good">Indicatief voordeel goedkoop laden t.o.v. direct: ${ehEuro2(diff)}</p>`}<details class="eh32-model"><summary>Databronnen en beperkingen</summary><p class="subtle">${ehEsc(source)} Het model gebruikt geen voorspelling van toekomstig huishoudverbruik. Zon vereist een expliciete PV-uurprognose en ingestelde terugleververgoeding; anders blijven kosten onbekend.</p></details><div class="cupra-safety">${ehIcon("shield")} Alle adviezen zijn uitsluitend simulaties. De Alfen en Active Load Balancing bepalen de werkelijk toegestane laadstroom.</div></section>`;
}

function eh17Budget(h,c){
 const now=new Date(),electric=ehRead(h,c.cost_zonneplan_month);
 const gas=c.gas_cost_month?ehRead(h,c.gas_cost_month):null;
 const fixed=eh17N(c.budget_other_month_eur)??0;
 const days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
 const elapsed=now.getDate()-1+(now.getHours()+now.getMinutes()/60)/24;
 const extrapolate=n=>n!==null&&elapsed>=1?n*days/elapsed:null;
 const electProj=extrapolate(electric),gasProj=extrapolate(gas),all=electProj!==null&&gasProj!==null?electProj+gasProj+fixed:null;
 const target=eh17N(c.monthly_budget_eur)??200;
 const percentage=all!==null?Math.max(0,Math.min(100,all/target*100)):electProj!==null?Math.max(0,Math.min(100,electProj/target*100)):0;
 return `<section class="subsection eh17-panel"><div class="eh17-title">${ehIcon("euro")} Maandprognose en budget</div><div class="eh17-grid"><div><small>Stroom · lineair voorspeld</small><strong>${ehEuro2(electProj)}</strong></div><div><small>Gas · lineair voorspeld</small><strong>${ehEuro2(gasProj)}</strong></div><div><small>Totaal incl. ingestelde overige kosten</small><strong>${ehEuro2(all)}</strong></div></div><div class="eh17-track"><div style="width:${percentage}%"></div></div><p class="subtle">Doel: onder ${ehEuro2(target)} per maand. ${all===null?"Het totaaldoel is niet toetsbaar totdat ook een echte gas-maandkostensensor is gekoppeld.":all<=target?"De huidige lineaire raming blijft onder het doel.":"De huidige lineaire raming ligt boven het doel."} Dit is een eenvoudige maandprojectie, geen seizoensvoorspelling. Vaste kosten tellen alleen mee als ze geconfigureerd zijn.</p></section>`;
}

function eh17PriceAt(series,t,unit){
 let p=null;
 for(const v of series){if(v.t>t)break;if(t-v.t<=90*60000)p=v;}
 if(!p)return null;const n=eh17N(p.v);if(n===null)return null;
 return unit.includes("cent")||unit.includes("ct/")?n/100:Math.abs(n)>10?n/10000000:n;
}

function eh17SessionsFromHistory(data,c,h){
  const energy=ehNumericHistory(data,c.laad_energie,h);
  const tariff=ehNumericHistory(data,c.prijs,h);
  const priceUnit=String(h?.states?.[c.prijs]?.attributes?.unit_of_measurement||"").toLowerCase();
  const sessions=[],meta={points:energy.length,from:energy[0]?.t??null,to:energy[energy.length-1]?.t??null,skipped:0,uncertainKwh:0,small:0,rawSessions:0};
  let cur=null;
  for(let i=1;i<energy.length;i++){
    const prev=energy[i-1],next=energy[i],dt=next.t-prev.t;
    if(dt<=0)continue;
    const delta=ehToKwh(next.v-prev.v,next.unit||prev.unit||h?.states?.[c.laad_energie]?.attributes?.unit_of_measurement);
    if(delta===null){meta.skipped++;cur=null;continue;}
    if(delta<-.01){meta.skipped++;cur=null;continue;} // tellerreset of bronwissel
    if(delta<=.001) {
      if(cur && next.t-cur.end>45*60000)cur=null;
      continue;
    }
    const hours=dt/3600000;
    if(delta>hours*9.5+.25 || dt>12*3600000){meta.skipped++;meta.uncertainKwh+=delta;cur=null;continue;}
    if(delta<.08)meta.small++; // telt nu wel mee
    const uncertain=dt>50*60000;
    if(!cur || prev.t-cur.end>50*60000 || uncertain){
      cur={start:prev.t,end:next.t,kwh:0,cost:0,missing:0,firstPrice:null,estimated:uncertain};
      sessions.push(cur);
    }
    cur.end=next.t;
    cur.kwh+=delta;
    cur.estimated=cur.estimated||uncertain;
    const p=eh17PriceAt(tariff,next.t,priceUnit);
    if(p===null)cur.missing+=delta;
    else{cur.cost+=delta*p;if(cur.firstPrice===null)cur.firstPrice=p;}
  }
  meta.rawSessions=sessions.length;
  const recognized=sessions.filter(s=>s.kwh>=.25).slice(-100).reverse();
  recognized.meta=meta;
  return recognized;
}

function eh17SessionsHtml(card,h,c){
  const result=card._eh17Sessions;
  if(!card._eh17SessionsLoading&&(!result||Date.now()-result.at>15*60000))card._eh17LoadSessions();
  if(!result)return '<section class="cupra-card eh17-panel"><div class="eh17-title">Laadgeschiedenis ophalen…</div></section>';
  if(result.error)return '<section class="cupra-card eh17-panel"><div class="eh17-title">Laadgeschiedenis</div><p class="subtle">'+ehEsc(result.error)+'</p></section>';
  const sessions=result.sessions||[],meta=result.meta||{};
  const days=Math.min(30,Math.max(1,Math.round(eh17N(c.charge_history_days)??30)));
  const coverage=meta.from===null?'Geen Alfen-meetpunten beschikbaar.':'Alfen-detailmetingen: '+ehEsc(new Date(meta.from).toLocaleDateString('nl-NL'))+' t/m '+ehEsc(new Date(meta.to).toLocaleDateString('nl-NL'))+'.';
  const rows=sessions.map(s=>{
    const complete=s.missing<.01,delta=s.firstPrice!==null&&complete?s.kwh*s.firstPrice-s.cost:null;
    const label=s.estimated?'Geschat · meetgat':'Herkend';
    return '<div class="eh17-session"><span>'+ehEsc(new Date(s.start).toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}))+'<small>'+ehEsc(ehClock(s.start))+'–'+ehEsc(ehClock(s.end))+'</small></span><span><strong>'+ehFmt(s.kwh,2)+' kWh</strong><small>'+label+'</small></span><span><strong>'+(complete?ehEuro2(s.cost):'Prijs onvolledig')+'</strong><small>'+(delta===null?'':('Indicatief vs starttarief: '+ehEuro2(delta)))+'</small></span></div>';
  }).join('');
  return '<section class="cupra-card eh17-panel"><div class="eh17-title">'+ehIcon('clock')+' Laadgeschiedenis · maximaal '+days+' dagen <span class="eh17-tag">'+sessions.length+' gevonden</span></div>'+
   '<p class="subtle">'+coverage+' '+ehFmt(meta.points||0,0)+' meetpunten, '+ehFmt(meta.small||0,0)+' kleine increments behouden. '+
   (meta.skipped?'Niet betrouwbaar toe te wijzen intervallen: '+meta.skipped+' ('+ehFmt(meta.uncertainKwh||0,2)+' kWh). ':'')+
   'Werkelijke historie kan korter zijn door de Recorder-retentie.</p>'+
   (rows||'<p class="subtle">Geen sessies vanaf 0,25 kWh herkenbaar. Controleer Alfen-tellerhistorie en Recorder.</p>')+
   '<p class="subtle">Schatting op basis van Alfen-tellerverschillen. Meetgaten kunnen starttijd en aantal sessies onzeker maken. Prijsgaten veranderen het sessieaantal niet. Deze analyse schrijft niets weg naar Home Assistant.</p></section>';
}

function eh17BatteryFromStats(data,c,h,now){
 const from=new Date(now.getFullYear(),now.getMonth(),now.getDate()-7),to=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const bins=ehWindows({from,to,step:"day"}),bucket=ehCountersByWindow(data,[c.import,c.export],bins,"day",h);
 const convert=(value,id)=>{
  if(!Number.isFinite(value))return null;
  const unit=String(h?.states?.[id]?.attributes?.unit_of_measurement||"kWh").trim().toLowerCase();
  return unit==="wh"?value/1000:unit==="kwh"?value:null;
 };
 return bins.map(b=>({t:b.t,import:convert(bucket[c.import]?.totals?.get(b.key),c.import),export:convert(bucket[c.export]?.totals?.get(b.key),c.export)})).filter(x=>Number.isFinite(x.import)&&Number.isFinite(x.export));
}

function eh191BatteryScenario(days,cap,eff,buy,sell){
 if(!Array.isArray(days)||days.length<2)return {capacity:cap,monthKwh:null,monthEuro:null,avgDayKwh:null};
 const bounded=days.map(d=>Math.min(cap,Math.max(0,d.export),Math.max(0,d.import)/Math.max(.01,eff)));
 const avgDayKwh=bounded.reduce((s,v)=>s+v,0)/bounded.length;
 return {
  capacity:cap,avgDayKwh,
  monthKwh:avgDayKwh*eff*30.44,
  monthEuro:avgDayKwh*(eff*buy-sell)*30.44
 };
}
function eh17BatteryHtml(card,h,c){
 if(!card._eh17BatteryLoading&&(!card._eh17Battery||Date.now()-card._eh17Battery.at>30*60000))card._eh17LoadBattery();
 const data=card._eh17Battery,cap=[5,10,15].includes(Number(card._eh17Capacity))?Number(card._eh17Capacity):10;
 const eff=eh17N(c.battery_roundtrip_efficiency)??.88,buy=eh17N(c.battery_buy_eur_kwh)??.25,sell=eh17N(c.battery_sell_eur_kwh)??.08;
 const days=(data?.rows||[]).filter(d=>Number.isFinite(d.import)&&Number.isFinite(d.export));
 const scenarios=[5,10,15].map(n=>eh191BatteryScenario(days,n,eff,buy,sell));
 const selected=scenarios.find(s=>s.capacity===cap);
 const valid=scenarios.every(s=>s.monthKwh!==null);
 const equal=valid&&Math.abs(scenarios[2].monthKwh-scenarios[0].monthKwh)<.05;
 const deltakwh=valid?selected.monthKwh-scenarios[0].monthKwh:null;
 const deltaeur=valid?selected.monthEuro-scenarios[0].monthEuro:null;
 const status=!data?(card._eh17BatteryLoading?"Recorder-statistieken ophalen…":"Geen meetgegevens ontvangen. Controleer Home Assistant Recorder en de P1 import-/exportsensoren.")
  :data.error|| (days.length<2?"Nog onvoldoende complete meetdagen: minimaal twee dagen met geldige netafname én teruglevering nodig."
  :equal?"Alle capaciteiten leveren volgens deze dagtotalen ongeveer dezelfde uitkomst op. Niet de accugrootte, maar de beschikbare teruglevering of netafname beperkt de berekening."
  :"Grotere capaciteit kan extra energie verschuiven in de indicatieve dagtotalenberekening.");
 const options=[5,10,15].map(n=>'<button type="button" data-eh17-cap="'+n+'" class="'+(n===cap?'active':'')+'" aria-pressed="'+(n===cap)+'" aria-label="Vergelijk '+n+' kWh">'+n+' kWh</button>').join("");
 const rows=scenarios.map(s=>'<tr class="'+(s.capacity===cap?'eh191-chosen':'')+'"><th scope="row">'+s.capacity+' kWh'+(s.capacity===cap?' · geselecteerd':'')+'</th><td>'+(s.monthKwh===null?'—':ehFmt(s.monthKwh,1)+' kWh')+'</td><td>'+(s.monthEuro===null?'—':ehEuro2(s.monthEuro))+'</td></tr>').join("");
 return '<section class="subsection eh17-panel" aria-label="Batterijcapaciteit vergelijken">'+
  '<div class="eh17-title">'+ehIcon("battery")+' Virtuele batterij · capaciteitsvergelijking</div>'+
  '<p class="eh191-kicker">Gekozen batterij: <strong>'+cap+' kWh</strong> · alleen onderstaande scenariovergelijking verandert. De cijfers bovenaan komen uit de bestaande vaste 10-kWh-simulatie in Home Assistant.</p>'+
  '<div class="eh17-choices" role="group" aria-label="Selecteer batterijcapaciteit">'+options+'</div>'+
  '<div class="eh17-grid" aria-live="polite"><div><small>Bij '+cap+' kWh: indicatief hergebruik per maand</small><strong>'+(selected.monthKwh===null?'—':ehFmt(selected.monthKwh,1)+' kWh')+'</strong></div>'+
  '<div><small>Bij '+cap+' kWh: indicatief financieel potentieel per maand</small><strong>'+(selected.monthEuro===null?'—':ehEuro2(selected.monthEuro))+'</strong></div>'+
  '<div><small>Verschil met 5 kWh</small><strong>'+(deltakwh===null?'—':(Math.abs(deltakwh)<.05?'0,0':ehFmt(deltakwh,1))+' kWh')+'</strong><small>'+(deltaeur===null?'Niet te bepalen':(Math.abs(deltaeur)<.005?'€ 0,00':ehEuro2(deltaeur))+' per maand')+'</small></div>'+
  '<div><small>Volledige gemeten dagen</small><strong>'+days.length+' / 7</strong></div></div>'+
  '<div class="eh191-tablewrap"><table class="eh191-table"><caption>Capaciteiten naast elkaar op basis van dezelfde beschikbare meetdagen</caption><thead><tr><th scope="col">Capaciteit</th><th scope="col">Hergebruik/maand</th><th scope="col">Potentieel/maand</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
  '<p class="eh191-reason" role="status">'+ehEsc(status)+'</p>'+
  '<p class="subtle">Dit is een theoretische bovengrens op basis van dagelijkse P1-netafname en -teruglevering; geen echte batterijprestatie, uurvolgorde, winstgarantie of terugverdientijd. Aannames: '+ehFmt(eff*100,0)+'% rondrendement, '+ehEuro2(buy)+'/kWh vermeden inkoop en '+ehEuro2(sell)+'/kWh gemiste teruglevering. Voor nauwkeurige kosten zijn historische uurprijzen en een laad-/ontlaadstrategie nodig.</p></section>';
}


function eh17ResetDefs(c,h){
 const source=h?eh171Sources(h,c):null;
 return [["in","P1 afname",c.import],["out","P1 teruglevering",c.export],["ev","Alfen geladen energie",c.laad_energie],["gas","Gasmeter",source?.gas.total||c.gas],["water","Watermeter",source?.water.total||c.water],["pv","Totale PV-opwek",c.pv_total_energy],["bill","Cumulatieve contractkosten",c.billing_total_cost]];
}

function eh17ResetState(h,c){
 const id=c.reset_store,raw=h?.states?.[id]?.state;
 if(!id||!id.startsWith("input_text.")||raw===undefined)return {error:"Maak eerst de Home Assistant-helper input_text.energiehuis_reset_baselines aan (zie installatiehandleiding).",b:{}};
 if(raw==="unknown"||raw==="unavailable")return {b:{},error:"Reset-helper niet beschikbaar."};
 if(raw==="")return {b:{},error:null};
 try{const parsed=JSON.parse(raw);if(parsed?.v!==1||!parsed.b||typeof parsed.b!=="object"||Array.isArray(parsed.b))throw Error("formaat");return {b:parsed.b,error:null};}
 catch(_){return {error:"De opslag-helper bevat geen geldig Energiehuis-nulmetingformaat. Er wordt niets overschreven.",b:{}};}
}

function eh17ResetHtml(card,h,c){
 const initial=eh17ResetState(h,c);
 const currentRaw=h?.states?.[c.reset_store]?.state;
 if(card._eh17PendingReset&&(card._eh17PendingReset.raw===currentRaw||Date.now()-card._eh17PendingReset.at>15000))card._eh17PendingReset=null;
 const store=card._eh17PendingReset??initial;
 const entries=eh17ResetDefs(c,h).filter(([, ,id])=>id).map(([key,label,id])=>{
  const st=h?.states?.[id],n=eh17N(st?.state),unit=String(st?.attributes?.unit_of_measurement||"").trim();
  const baseline=store.b?.[key],valid=Array.isArray(baseline)&&baseline.length>=3&&baseline[2]===eh17Hash(id)&&Number.isFinite(eh17N(baseline[0]));
  const delta=valid&&n!==null?n-baseline[0]:null;
  const t=valid?new Date(baseline[1]*1000).toLocaleDateString("nl-NL",{day:"numeric",month:"short",year:"numeric"}):"Nog niet ingesteld";
  return `<label class="eh17-reset-row"><input type="checkbox" data-eh17-select="${key}" ${card._eh17ResetKeys?.has(key)?"checked":""} ${n===null?"disabled":""}/><span><strong>${ehEsc(label)}</strong><small>${ehEsc(id)} · ${ehEsc(t)}</small></span><span><strong>${delta===null?"—":delta<0?"Teller lager dan nulmeting":ehFmt(delta,2)+" "+ehEsc(unit)}</strong><small>Stand: ${n===null?"Onbekend":ehFmt(n,2)+" "+ehEsc(unit)}</small></span></label>`;
 }).join("");
 const chosen=(card._eh17Confirm||[]).map(key=>eh17ResetDefs(c,h).find(d=>d[0]===key)?.[1]).filter(Boolean);
 const confirm=chosen.length?`<div class="eh17-confirm" role="alertdialog" aria-modal="true" aria-label="Bevestig nieuwe nulmeting"><strong>Bevestig nieuwe nulmeting</strong><p>Wil je voor <b>${ehEsc(chosen.join(", "))}</b> de huidige meterstanden als nieuw beginpunt bewaren? Bestaande nulmetingen voor deze selectie worden vervangen. De originele meterstanden en historische gegevens blijven behouden.</p><div class="eh17-confirm-actions"><button type="button" data-eh17-cancel="1">Annuleren</button><button type="button" class="danger" data-eh17-confirm="1">Ja, nulmeting vastleggen</button></div></div>`:"";
 const status=card._eh17ResetMsg?`<p class="eh17-status" role="status">${ehEsc(card._eh17ResetMsg)}</p>`:"";
 return `<section class="subsection eh17-panel"><button class="eh17-collapse" type="button" data-eh17-toggle-reset="1">${ehIcon("shield")} Geavanceerd · Meterbeheer &amp; Reset ${card._eh17ResetOpen?"▴":"▾"}</button>${card._eh17ResetOpen?`<p class="subtle">Bij een nieuw contract leg je per meter een nieuwe beginstand vast. Alleen de relatieve stand <em>sinds nulmeting</em> wordt hier opnieuw vanaf nul berekend. Er gaan geen resetcommando's naar P1, GoodWe, Alfen, gas- of watermeters.</p>${initial.error?`<p class="plan-warning">${ehEsc(initial.error)}</p>`:""}<div class="eh17-reset-items">${entries}</div><button type="button" class="eh17-primary" data-eh17-preview="1" ${initial.error||card._eh17ResetSaving?"disabled":""}>Nieuwe nulmeting voor selectie…</button>${confirm}${status}<p class="subtle">De nulmetingen staan centraal in Home Assistant, niet alleen op je telefoon. Kosten per maand, vergelijkingsgrafieken en fysieke totalen worden hierdoor niet gereset. Gebruik daarvoor een aparte, gecontroleerde contractperiode.</p>`:""}</section>`;
}

function eh17MoreHtml(card,h,c){
 const quality=eh17Health(h,c),bad=quality.filter(q=>!["Actueel","Controleer daglicht"].includes(q.status));
 return `<section class="subsection eh17-panel"><div class="eh17-title">${ehIcon("shield")} Systeemcontrole <span class="eh17-tag">${bad.length?"Aandachtspunten: "+bad.length:"Bronnen lijken actueel"}</span></div><div class="eh17-health">${quality.map(q=>`<div><span>${ehEsc(q.name)}<small>${ehEsc(q.id||"Niet ingesteld")}</small></span><strong class="${q.status==="Actueel"?"eh17-good":""}">${ehEsc(q.status)}</strong></div>`).join("")}</div><p class="subtle">Status op basis van beschikbaarheid, eenheid en laatste HA-update. Dit bewijst geen volledige nauwkeurigheid van de meting. Zonnepanelen kunnen 's nachts stilstaan.</p></section>${eh17ResetHtml(card,h,c)}`;
}

function eh17Css(){
 return `.eh191-kicker{font-size:12px;line-height:1.5;color:#c6d9e6;margin:0 0 12px}.eh191-kicker strong{color:#62e7bc}.eh191-reason{font-size:12px;line-height:1.5;color:#ffda9d;background:#76551626;border-left:3px solid #e7bc72;padding:10px 12px;border-radius:5px;margin:12px 0}.eh191-tablewrap{overflow-x:auto;margin:13px 0}.eh191-table{border-collapse:collapse;width:100%;font-size:12px;min-width:320px}.eh191-table caption{text-align:left;color:#a9c6d6;font-size:10px;padding:8px 0}.eh191-table th,.eh191-table td{text-align:left;border-bottom:1px solid #b6dae32c;padding:10px 7px}.eh191-table thead{color:#accdde}.eh191-table .eh191-chosen{background:#185a4336;color:#c9ffdf}.eh17-panel{margin-top:14px}.eh17-title{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800;margin-bottom:13px;flex-wrap:wrap}.eh17-title .icon{width:19px;height:19px;color:#59dcbc}.eh17-tag{font-size:10px;color:#b7edda;border:1px solid #60cfa244;border-radius:20px;padding:4px 8px;font-weight:550}.eh17-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:9px}.eh17-grid>div,.eh17-option{padding:12px;border-radius:12px;background:#0a2435;border:1px solid #98cde02b;display:flex;flex-direction:column;gap:5px}.eh17-grid p{margin:4px 0;color:#c6d9e6;line-height:1.5;font-size:12px}.eh17-grid strong{font-size:18px;color:#e9f9ff}.eh17-grid small,.eh17-option small{color:#a8cbdb;font-size:11px}.eh17-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.eh17-option strong{color:#4ae4b3;font-size:21px}.eh17-option span,.eh17-option em{font-size:11px;font-style:normal;color:#c3d7e6;line-height:1.5}.eh17-option em{color:#ffcc78}.eh17-good{color:#56e8b6!important}.eh17-track{height:9px;border-radius:20px;background:#264258;margin-top:15px;overflow:hidden}.eh17-track>div{height:100%;background:#4bd7b3;border-radius:20px}.eh17-session{display:grid;grid-template-columns:1.2fr 1fr 1.2fr;gap:10px;border-top:1px solid #9db9ca2f;padding:12px 0;font-size:12px}.eh17-session>span{display:flex;flex-direction:column;gap:6px}.eh17-session small{font-size:10px;color:#9fbccc}.eh17-choices{display:flex;gap:7px;margin-bottom:14px}.eh17-choices button,.eh17-primary,.eh17-confirm-actions button{font:inherit;color:#d5eaf5;background:#102c40;border:1px solid #6aadc34a;border-radius:9px;padding:10px 13px;cursor:pointer}.eh17-choices button.active,.eh17-primary{background:#15503f;color:#e9fff7;border-color:#53dfad}.eh17-health>div{display:flex;justify-content:space-between;gap:9px;padding:10px 0;border-bottom:1px solid #abc3d422;font-size:12px}.eh17-health span{display:flex;flex-direction:column;gap:4px}.eh17-health small{font-size:10px;color:#a7c0d3;overflow-wrap:anywhere}.eh17-health strong{white-space:nowrap}.eh17-collapse{background:transparent;color:#e8f7ff;border:none;font:inherit;font-size:15px;font-weight:750;cursor:pointer;padding:3px;display:flex;gap:9px;align-items:center}.eh17-reset-items{display:grid;gap:8px;margin:15px 0}.eh17-reset-row{display:flex;align-items:center;gap:10px;border:1px solid #aac3d431;border-radius:10px;background:#0a2636;padding:11px;font-size:12px;cursor:pointer}.eh17-reset-row>span{flex:1;display:flex;flex-direction:column;gap:4px;min-width:0}.eh17-reset-row>span:last-child{text-align:right}.eh17-reset-row small{font-size:10px;color:#a8bfcb;overflow-wrap:anywhere}.eh17-reset-row input{accent-color:#34d5a0;width:18px;height:18px}.eh17-confirm{margin-top:12px;padding:17px;border:1px solid #f0b86788;border-radius:13px;background:#3d2b1e;color:#ffe7c3;font-size:13px;line-height:1.55}.eh17-confirm-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}.eh17-confirm-actions .danger{background:#9b422e;color:white;border-color:#eb966e}.eh17-primary:disabled{opacity:.5;cursor:not-allowed}.eh17-status{color:#9fe7ce;font-size:12px}.eh17-panel .cupra-safety{margin-top:12px}@media(max-width:550px){.eh17-options{grid-template-columns:1fr}.eh17-session{grid-template-columns:1fr 1fr}.eh17-session>span:last-child{grid-column:1/-1}.eh17-health strong{font-size:11px}.eh17-reset-row{align-items:flex-start}.eh17-reset-row>span:last-child{flex:0 0 34%}}`;
}

function eh17Enhance(){
 const P=EnergiehuisCard.prototype;
 const oldCupra=P._cupraHtml,oldBattery=P._batteryHtml,oldCosts=P._costsHtml,oldMore=P._moreHtml,oldRender=P._render;
 P._cupraHtml=function(h,c){
  const base=oldCupra.call(this,h,c);
  return base.replace("</main>",(this._view==="charge"?eh17Charge(h,c,this):eh17SessionsHtml(this,h,c))+"</main>");
 };
 P._batteryHtml=function(h,c){return oldBattery.call(this,h,c).replace("</main>",eh17BatteryHtml(this,h,c)+"</main>");};
 P._costsHtml=function(h,c){return oldCosts.call(this,h,c).replace("</main>",eh17Budget(h,c)+"</main>");};
 P._moreHtml=function(h,c){return oldMore.call(this,h,c).replace("</main>",eh17MoreHtml(this,h,c)+"</main>");};
 P._render=function(){
  oldRender.call(this);
  if(!this.shadowRoot||!this.config||!this._hass)return;
  // Lifecycle callbacks were captured when customElements.define() ran.
  // Install battery/reset click handling when the card actually renders.
  if(!this._eh17EventsReady)this._eh17BindControls();
  const style=this.shadowRoot.querySelector("style");
  if(style)style.textContent+="\n"+eh17Css();
  if(this._view==="overview"){
    const chart=this.shadowRoot.querySelector(".body .chart-panel");
    if(chart)chart.insertAdjacentHTML("beforebegin",eh17Coach(this._hass,this.config));
  }
 };
 P._eh17LoadSessions=async function(){
  const h=this._hass,c=this.config;
  if(this._eh17SessionsLoading||!this.isConnected||!h?.callWS||!c||!c.laad_energie)return;
  this._eh17SessionsLoading=true;
  const now=new Date(),days=Math.min(30,Math.max(1,Math.round(eh17N(c.charge_history_days)??30))),from=new Date(now.getTime()-days*86400000),ids=[c.laad_energie,c.prijs].filter(Boolean);
  try{
    const data=await h.callWS({type:"history/history_during_period",start_time:from.toISOString(),end_time:now.toISOString(),entity_ids:[...new Set(ids)],minimal_response:false,no_attributes:false,significant_changes_only:false});
    const sessions=eh17SessionsFromHistory(data,c,h);
    this._eh17Sessions={at:Date.now(),sessions,meta:sessions.meta};
  }catch(_){this._eh17Sessions={at:Date.now(),error:"Recorder-detailhistorie voor de gekozen periode is niet beschikbaar."};}
  finally{this._eh17SessionsLoading=false;this._schedule();}
 };
 P._eh17LoadBattery=async function(){
  const h=this._hass,c=this.config;
  if(this._eh17BatteryLoading||!this.isConnected||!h?.callWS||!c?.import||!c?.export)return;
  this._eh17BatteryLoading=true;
  const now=new Date(),from=new Date(now.getFullYear(),now.getMonth(),now.getDate()-8);
  try{
    const data=await h.callWS({type:"recorder/statistics_during_period",start_time:from.toISOString(),end_time:now.toISOString(),statistic_ids:[c.import,c.export],period:"day",types:["change","sum"]});
    this._eh17Battery={at:Date.now(),rows:eh17BatteryFromStats(data,c,h,now)};
  }catch(_){this._eh17Battery={at:Date.now(),rows:[],error:"Recorder-statistieken voor afname en teruglevering zijn niet beschikbaar."};}
  finally{this._eh17BatteryLoading=false;this._schedule();}
 };
 P._eh17ResetNow=async function(){
  const h=this._hass,c=this.config,keys=this._eh17Confirm||[];
  if(this._eh17ResetSaving||!keys.length||!h?.callService)return;
  const state=eh17ResetState(h,c);
  if(state.error){this._eh17ResetMsg=state.error;this._eh17Confirm=null;this._schedule();return;}
  const baselines={...state.b};const stamp=Math.floor(Date.now()/1000);
  for(const key of keys){
    const def=eh17ResetDefs(c,h).find(d=>d[0]===key),id=def?.[2],n=eh17N(h.states?.[id]?.state);
    if(n===null){this._eh17ResetMsg="Meter niet meer beschikbaar: "+(def?.[1]||key);this._eh17Confirm=null;this._schedule();return;}
    baselines[key]=[n,stamp,eh17Hash(id)];
  }
  const value=JSON.stringify({v:1,b:baselines});
  if(value.length>255){this._eh17ResetMsg="Te veel nulmetingen voor de opslag-helper (maximaal 255 tekens).";this._eh17Confirm=null;this._schedule();return;}
  this._eh17ResetSaving=true;this._schedule();
  try{
    await h.callService("input_text","set_value",{entity_id:c.reset_store,value});
    this._eh17PendingReset={b:baselines,error:null,at:Date.now(),raw:value};
    this._eh17ResetMsg="Nieuwe nulmeting opgeslagen in Home Assistant voor "+keys.length+" meter(s).";
    this._eh17ResetKeys=new Set();
    this._eh17Confirm=null;
  }catch(err){this._eh17ResetMsg="Opslaan is mislukt. De bestaande nulmeting is niet bevestigd: "+String(err?.message||"onbekende fout");this._eh17Confirm=null;}
  finally{this._eh17ResetSaving=false;this._schedule();}
 };
 P._eh17BindControls=function(){
   if(this._eh17EventsReady)return;
   this._eh17EventsReady=true;this._eh17Capacity=10;this._eh17ResetKeys=new Set();this._eh17ResetOpen=false;
   this.shadowRoot.addEventListener("change",e=>{
     const key=e.target?.dataset?.eh17Select;
     if(key){if(e.target.checked)this._eh17ResetKeys.add(key);else this._eh17ResetKeys.delete(key);this._eh17Confirm=null;return;}
   });
   this.shadowRoot.addEventListener("click",e=>{
     const btn=e.target?.closest?.("[data-eh17-cap], [data-eh17-toggle-reset], [data-eh17-preview], [data-eh17-cancel], [data-eh17-confirm]");
     if(!btn)return;
     if(btn.hasAttribute("data-eh17-cap")){this._eh17Capacity=Number(btn.dataset.eh17Cap);this._schedule();return;}
     if(btn.hasAttribute("data-eh17-toggle-reset")){this._eh17ResetOpen=!this._eh17ResetOpen;this._eh17Confirm=null;this._schedule();return;}
     if(btn.hasAttribute("data-eh17-preview")){
       const st=eh17ResetState(this._hass,this.config);
       if(st.error){this._eh17ResetMsg=st.error;this._schedule();return;}
       if(!this._eh17ResetKeys.size){this._eh17ResetMsg="Selecteer eerst één of meer meters.";this._schedule();return;}
       this._eh17Confirm=[...this._eh17ResetKeys];this._eh17ResetMsg="";this._schedule();return;
     }
     if(btn.hasAttribute("data-eh17-cancel")){this._eh17Confirm=null;this._schedule();return;}
     if(btn.hasAttribute("data-eh17-confirm"))this._eh17ResetNow();
   });
 };
}

eh17Enhance();

function eh17ContractPanel(h,c) {
 const store=eh17ResetState(h,c);
 if(store.error)return "";
 const readings=eh17ResetDefs(c,h).map(([key,label,id])=>{
  const baseline=store.b?.[key],n=eh17N(h?.states?.[id]?.state);
  if(!id||!Array.isArray(baseline)||baseline[2]!==eh17Hash(id)||n===null)return null;
  const difference=n-eh17N(baseline[0]),unit=String(h?.states?.[id]?.attributes?.unit_of_measurement||"");
  if(!Number.isFinite(difference))return null;
  const since=new Date(baseline[1]*1000).toLocaleDateString("nl-NL",{day:"numeric",month:"short"});
  return `<div><span>${ehEsc(label)} <small>vanaf ${ehEsc(since)}</small></span><strong>${difference<0?"Teller gewijzigd":ehFmt(difference,2)+" "+ehEsc(unit)}</strong></div>`;
 }).filter(Boolean);
 if(!readings.length)return "";
 return `<section class="subsection eh17-panel"><div class="eh17-title">${ehIcon("clock")} Sinds de ingestelde nulmetingen</div><div class="eh17-health">${readings.join("")}</div><p class="subtle">Elke sensor heeft zijn eigen startdatum; de oorspronkelijke teller blijft ongewijzigd. Dit zijn ruwe meetverschillen, geen automatische nieuwe contractfactuur. Stel nieuwe nulmetingen in onder Meer → Meterbeheer.</p></section>`;
}
{
 const old=EnergiehuisCard.prototype._costsHtml;
 EnergiehuisCard.prototype._costsHtml=function(h,c){return old.call(this,h,c).replace("</main>",eh17ContractPanel(h,c)+"</main>");};
}

