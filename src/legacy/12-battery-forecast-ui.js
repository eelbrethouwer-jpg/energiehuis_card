/* v1.20: price-based battery outlook, not measured battery state or a live energy forecast.
   No HA service calls, no assumed PV generation or home consumption. */
function eh26BatteryForecast(h,c,now,capacity,power,mode){
 const feed=ehPricesForDay(h,c,now);
 const merged=ehHourlyFromPrices(feed.quarters,feed.hourly);
 const from=Math.ceil(now.getTime()/3600000)*3600000;
 const until=from+24*3600000,seen=new Set(),slots=[];
 for(const p of merged){
  const t=Date.parse(p.t);
  if(!Number.isFinite(t)||t<from||t>=until||seen.has(t)||!Number.isFinite(p.p))continue;
  seen.add(t);slots.push({t,price:p.p});
 }
 slots.sort((a,b)=>a.t-b.t);
 if(slots.length<3)return {slots:[],selected:[],missing:true,reason:'Minder dan 3 toekomstige uurprijzen beschikbaar in Zonneplan. Er worden geen prijzen of laaduren bijverzonnen.'};
 const count=Math.min(slots.length,Math.max(1,Math.min(6,Math.ceil(slots.length/4))),Math.max(1,Math.ceil(capacity/power)));
 const cheapest=slots.slice().sort((a,b)=>a.price-b.price||a.t-b.t).slice(0,count);
 const chosen=new Set(cheapest.map(s=>s.t));
 let soc=0;
 const eta=Math.sqrt(Math.max(.01,Math.min(1,eh17N(c.battery_roundtrip_efficiency)??.88)));
 const projected=slots.map(s=>{
  const eligible=chosen.has(s.t),gridKwh=mode==='smart'&&eligible?Math.min(power,Math.max(0,(capacity-soc)/eta)):0;
  if(mode==='smart')soc=Math.min(capacity,soc+gridKwh*eta);
  return {...s,eligible,gridKwh,projectedPct:mode==='smart'?100*soc/capacity:null};
 });
 return {slots:projected,selected:cheapest.sort((a,b)=>a.t-b.t),missing:false,
  complete:slots.length===24,from,until,capacity,power,mode};
}
function eh26ForecastHtml(h,c,cap,power,mode,now=new Date(),card=null){
 const result=eh26BatteryForecast(h,c,now,cap,power,mode);
 if(result.missing)return '<section class="eh26-outlook"><h4>Laadverwachting · komende 24 uur</h4><p class="eh20-notice">'+ehEsc(result.reason)+'</p><p class="eh26-foot">Controleer of de ingestelde Zonneplan-prijssensor toekomstige uur- of kwartiertarieven heeft. Dit is een alleen-lezen simulatie.</p></section>';
 const rows=result.slots,W=640,L=50,R=28,top=22,bottom=180;
 const prices=rows.map(p=>p.price),lo=Math.min(...prices),hi=Math.max(...prices);
 const margin=Math.max(.02,(hi-lo)*.18),min=lo-margin,max=hi+margin;
 const x=i=>L+(i+.5)*(W-L-R)/rows.length;
 const y=p=>bottom-(p-min)/(max-min)*(bottom-top);
 const line=rows.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(p.price).toFixed(1)).join(' ');
 const area=line+' L '+x(rows.length-1).toFixed(1)+','+bottom+' L '+x(0).toFixed(1)+','+bottom+' Z';
 const projected=mode==='smart'?rows.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+','+(bottom-(p.projectedPct/100)*(bottom-top)).toFixed(1)).join(' '):'';
 const barWidth=Math.max(5,(W-L-R)/rows.length*.7);
 const bars=rows.filter(s=>s.eligible).map(s=>{
  const i=rows.indexOf(s);
  return '<rect x="'+(x(i)-barWidth/2).toFixed(1)+'" y="'+top+'" width="'+barWidth.toFixed(1)+'" height="'+(bottom-top)+'" fill="#39caa1" opacity=".16"><title>'+ehEsc(new Date(s.t).toLocaleString('nl-NL',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+' · '+ehEuro2(s.price)+'/kWh · '+(mode==='smart'?'netlaadscenario':'potentieel goedkoop prijsuur')+'</title></rect>';
 }).join('');
 const chargeOverlay=mode==='smart'?rows.map((p,i)=>p.gridKwh>0?'<rect class="eh27-planned-charge" x="'+(x(i)-barWidth*.38).toFixed(1)+'" y="'+(bottom-Math.min(42,42*p.gridKwh/Math.max(.01,power))).toFixed(1)+'" width="'+(barWidth*.76).toFixed(1)+'" height="'+Math.min(42,42*p.gridKwh/Math.max(.01,power)).toFixed(1)+'" fill="#39e3a9" opacity=".8"><title>Hypothetisch netladen '+ehFmt(p.gridKwh,2)+' kWh</title></rect>':'').join(''):'';
 const labels=rows.map((p,i)=>i%Math.max(1,Math.ceil(rows.length/5))===0?'<text x="'+x(i).toFixed(1)+'" y="224" fill="#bdd4e1" text-anchor="middle" font-size="12">'+ehEsc(new Date(p.t).toLocaleString('nl-NL',{hour:'2-digit'}))+'</text>':'').join('');
 const selectedIndex=Number.isInteger(card?._eh27ForecastIndex)?card._eh27ForecastIndex:-1;
 const selectedPrice=rows[selectedIndex];
 const detail=selectedPrice?'<p class="eh27-price-detail" aria-live="polite">'+ehEsc(new Date(selectedPrice.t).toLocaleString('nl-NL',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+' · <strong>'+ehEuro2(selectedPrice.price)+'/kWh</strong> · '+(mode==='smart'?'Hypothetisch netladen '+ehFmt(selectedPrice.gridKwh,2)+' kWh':'Geen netladen')+'</p>':'';
 const hitboxes=rows.map((p,i)=>'<rect data-eh27-price-hour="'+i+'" x="'+(x(i)-barWidth*.7).toFixed(1)+'" y="'+top+'" width="'+(barWidth*1.4).toFixed(1)+'" height="'+(bottom-top)+'" role="button" tabindex="0" fill="transparent" aria-label="'+ehEsc(new Date(p.t).toLocaleString('nl-NL',{weekday:'short',hour:'2-digit',minute:'2-digit'}))+' '+ehEuro2(p.price)+'/kWh"><title>'+ehEuro2(p.price)+'/kWh</title></rect>').join('');
 const cheap=result.selected[0],earliest=cheap?new Date(cheap.t).toLocaleString('nl-NL',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
 const cheapestPrice=cheap?Math.min(...result.selected.map(p=>p.price)):null;
 const charged=rows.reduce((sum,p)=>sum+p.gridKwh,0);
 const forecastTitle=mode==='smart'?'Voorgestelde netlaaduren':'Goedkope stroomuren ter vergelijking';
 const notes=mode==='smart'?
  'Witte stippellijn: zuiver hypothetisch SOC vanaf 0%, zonder verbruik, ontladen of zonladen. Niet de actuele batterijstand en geen echt uitvoerbaar laadplan.':
  'Alleen-zonmodus: geen netlading gepland. Zonder betrouwbare PV- en verbruiksprognose voorspellen we geen toekomstige batterijvulling.';
 const status=result.complete?'24 toekomstige uren met uurprijzen':'Slechts '+rows.length+' van 24 toekomstige uren met prijzen; goedkoopste selectie is onvolledig';
 const subtitle=mode==='smart'?'<strong>Netladen in dit voorbeeld: '+ehFmt(charged,1)+' kWh</strong> · gekozen uren zijn de goedkoopste beschikbare '+result.selected.length+' uurblokken.':'<strong>Geen netladen</strong> · de groene uren zijn alleen prijsinformatie.';
 return '<section class="eh26-outlook" aria-label="Toekomstige prijsuren en virtueel batterijlaadscenario">'+
  '<div class="eh26-outlook-head"><h4>Laadverwachting · komende 24 uur</h4><small>Prognose, geen meting</small></div>'+
  '<div class="eh26-price-highlights"><div><small>Laagste bekende uurprijs</small><strong>'+ehEuro2(cheapestPrice)+'/kWh</strong></div>'+
  '<div><small>Eerstvolgende geselecteerde uur</small><strong>'+ehEsc(earliest)+'</strong></div></div>'+
  '<div class="eh26-chart-key"><span><i class="eh26-price-line"></i>Stroomprijs</span><span><i class="eh26-charge-bar"></i>'+ehEsc(forecastTitle)+'</span>'+
  (mode==='smart'?'<span><i class="eh26-soc-line"></i>Scenario-SOC</span>':'')+'</div>'+
  '<svg class="eh26-forecast-svg" viewBox="0 0 640 226" role="img" aria-label="Toekomstige uurprijzen, geselecteerde goedkope uren'+(mode==='smart'?' en hypothetische batterijvulling vanaf nul procent':'')+'">'+
  '<line x1="'+L+'" y1="'+bottom+'" x2="'+(W-R)+'" y2="'+bottom+'" stroke="#829eaf" opacity=".7"/>'+
  '<text x="2" y="24" fill="#c8dce7" font-size="13">'+ehEsc(ehEuro2(max))+'</text><text x="2" y="'+(bottom+4)+'" fill="#c8dce7" font-size="13">'+ehEsc(ehEuro2(min))+'</text>'+
  '<defs><linearGradient id="eh27-price-shade" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#59b8ff" stop-opacity=".24"/><stop offset="100%" stop-color="#59b8ff" stop-opacity="0"/></linearGradient></defs>'+
  '<path d="'+area+'" fill="url(#eh27-price-shade)"/>'+bars+chargeOverlay+
  '<path d="'+line+'" fill="none" stroke="#79bdff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'+
  (projected?'<path class="eh26-projected-soc" d="'+projected+'" fill="none" stroke="#fff" stroke-dasharray="7 5" stroke-width="2" opacity=".9"/>':'')+
  labels+hitboxes+'</svg>'+detail+'<p class="eh26-outlook-summary">'+subtitle+'</p>'+
  '<p class="eh26-foot">'+ehEsc(status)+' · '+ehEsc(notes)+'</p>'+
  '<details class="eh27-chart-info"><summary>Berekening en beperkingen</summary><p class="eh26-foot">Selectie op basis van beschikbare Zonneplan-uurprijzen, zonder terugleververgoeding, slijtage of netbelasting. Bij onvolledige prijzen geen garantie op goedkoopste uren. Geen Home Assistant- of Alfen-commando’s.</p></details></section>';
}
function eh26BatteryTabs(card){
 const active=['today','history','returns','compare'].includes(card._eh26Tab)?card._eh26Tab:'today';
 return '<div class="eh26-tabs" role="group" aria-label="Batterijpagina-onderdelen">'+
  [['today','Vandaag'],['history','Historie'],['returns','Rendement'],['compare','Vergelijken']].map(([key,name])=>'<button type="button" data-eh26-tab="'+key+'" aria-pressed="'+(active===key)+'" class="'+(active===key?'selected':'')+'">'+name+'</button>').join('')+'</div>';
}
function eh26BatteryCss(){
 return '.eh26-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:14px 0 11px}.eh26-tabs button{min-width:0;min-height:45px;border-radius:10px;background:#102e40;color:#d8ebf3;border:1px solid #7395a7;font:inherit;font-size:13px;cursor:pointer}.eh26-tabs button.selected{background:#17604c;border-color:#55dfb1;color:#fff;font-weight:700}.eh26-tabs button:focus-visible{outline:2px solid white;outline-offset:2px}.eh26-panel[hidden]{display:none!important}.eh26-overview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:12px 0}.eh26-overview>div{padding:11px 9px;background:#09293b;border-radius:10px;border:1px solid #85acc02d;min-width:0}.eh26-overview small{display:block;font-size:10px;color:#acc8d5;line-height:1.4}.eh26-overview strong{display:block;font-size:17px;margin-top:6px;overflow-wrap:anywhere}.eh26-outlook{border:1px solid #5a91a282;border-radius:13px;background:#0a2939;padding:12px;min-width:0}.eh26-outlook-head{display:flex;gap:5px;justify-content:space-between;align-items:center;flex-wrap:wrap}.eh26-outlook h4{font-size:15px;margin:0}.eh26-outlook-head small{font-size:10px;color:#9cbfd0}.eh26-price-highlights{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}.eh26-price-highlights>div{padding:10px;background:#12364a;border:1px solid #6f9baa55;border-radius:9px;min-width:0}.eh26-price-highlights small{display:block;color:#b6d2dc;font-size:10px;margin-bottom:6px}.eh26-price-highlights strong{font-size:13px;overflow-wrap:anywhere}.eh26-chart-key{display:flex;gap:8px 13px;flex-wrap:wrap;color:#c0dce7;font-size:10px}.eh26-chart-key span{display:inline-flex;align-items:center;gap:5px}.eh26-chart-key i{width:13px;height:0;border-top:3px solid #79bdff}.eh26-chart-key .eh26-charge-bar{height:10px;background:#39caa166;border:1px solid #39caa1}.eh26-chart-key .eh26-soc-line{border-top:2px dashed white}.eh26-forecast-svg{display:block;width:100%;height:auto;max-height:240px;margin-top:5px}.eh26-outlook-summary{font-size:12px;margin:8px 0;color:#d3e9f0;line-height:1.5}.eh26-foot{font-size:11px;color:#a7c6d2;line-height:1.45;margin:7px 0}.eh26-history .eh20-kpis{display:none}.eh26-advanced{border:1px solid #6c94aa55;border-radius:10px;padding:10px;margin:12px 0}.eh26-advanced summary{cursor:pointer;font-weight:700;font-size:12px}.eh26-advanced .eh20-meta{line-height:1.45}@media(max-width:370px){.eh26-overview strong{font-size:14px}.eh26-outlook{padding:9px}.eh26-price-highlights{grid-template-columns:1fr}.eh26-tabs button{font-size:12px}}'+
 '.eh23-battery-page .subpage-head p{display:none}.eh23-battery-page .subpage-head h2{font-size:22px;margin:2px 0}.eh23-battery-page .eh20-panel>h3{display:none}.eh23-battery-page .eh20-panel{background:linear-gradient(145deg,#0b293f,#071e33);border-radius:17px;padding:12px}.eh26-overview>div{background:linear-gradient(140deg,#10394b,#09273a);border-color:#398a9460;min-height:65px}.eh26-overview strong{font-size:18px;color:#f0fffb}.eh26-overview>div:last-child strong{color:#4de6b8}.eh26-outlook,.eh23-flow,.eh22-finance{background:linear-gradient(155deg,#0d3047,#092637);border:1px solid #538b9b80;border-radius:17px;padding:14px;box-shadow:0 7px 30px #020d1d25}.eh26-outlook h4,.eh23-flow h4,.eh22-finance h3{font-size:17px;color:#e8fff7}.eh26-price-highlights>div{background:#10374b;border-radius:11px;border-color:#5391aa70}.eh26-price-highlights strong{font-size:16px}.eh26-forecast-svg{max-height:280px;touch-action:pan-y}.eh26-forecast-svg [data-eh27-price-hour]{cursor:pointer}.eh26-forecast-svg [data-eh27-price-hour]:focus-visible{stroke:#eafff9;stroke-width:1.5}.eh27-price-detail{border:1px solid #55cfa477;border-radius:10px;background:#0e463b;padding:9px 11px;margin:8px 0;font-size:12px;color:#d7fff4}.eh23-flow-svg{max-height:300px}.eh24-tabs button.selected{background:#176d54!important;color:#fff;border-color:#52e1b3!important}.eh27-chart-info,.eh27-finance-more{border:1px solid #638b9a64;border-radius:10px;padding:10px 12px;margin-top:11px;background:#09233480}.eh27-chart-info summary,.eh27-finance-more summary{cursor:pointer;color:#cee9eb;font-size:12px;font-weight:650;min-height:28px}.eh27-finance-chart{border:1px solid #598e9a60;background:#09293b;border-radius:12px;padding:12px;margin:12px 0}.eh27-finance-chart h4{font-size:13px;margin:0 0 4px;color:#c8eff0}.eh27-finance-chart svg{width:100%;height:auto;max-height:174px}.eh27-finance-chart small{display:block;font-size:10px;color:#adcbd5}.eh22-ledger>div:last-child strong{color:#53e1b4}.eh23-cap-tabs button.chosen,.eh20-modes button.chosen{background:#176c52;border-color:#64ecbf}@media(max-width:440px){.eh23-battery-page .eh20-panel{padding:8px}.eh26-outlook,.eh23-flow,.eh22-finance{padding:10px}.eh26-overview strong{font-size:15px}.eh26-price-highlights strong{font-size:13px}.eh27-finance-chart{padding:8px}}';
}

function eh20BatteryView(card,h,c){
 if(card._eh26Tab==='compare')return eh26BatteryTabs(card)+eh31CompareHtml(card);
 const data=card._eh20Battery,cap=[5,10,15].includes(card._eh17Capacity)?card._eh17Capacity:10;
 const days=card._eh22Days===30?30:7;
 let mode=card._eh20Mode==='smart'?'smart':'solar';
 if(card.isConnected&&!card._eh20Loading&&(!data||data.days!==days||Date.now()-data.at>30*60000))card._eh20LoadBattery();
 const baseNote='<p class="subtle">Afzonderlijk chronologisch uurmodel. Start met een lege batterij; bij ontbrekende uren wordt de SOC niet over dat gat doorgetrokken. Uurafname/-teruglevering bepalen geen exacte volgorde binnen het uur. Geen fysieke batterij en geen laadcommando’s.</p>';
 if(!data)return eh26BatteryTabs(card)+'<section class="subsection eh20-panel"><h3>Batterij Simulator 3.0 · uurhistorie</h3><p class="subtle">P1-uurstatistieken ophalen uit Home Assistant Recorder…</p>'+baseNote+'</section>';
 if(data.error)return eh26BatteryTabs(card)+'<section class="subsection eh20-panel"><h3>Batterij Simulator 3.0 · uurhistorie</h3><p class="eh20-notice">'+ehEsc(data.error)+'</p>'+baseNote+eh25AuditHtml(card,h,c,[])+'</section>';
 const eff=eh17N(c.battery_roundtrip_efficiency)??.88,buy=eh17N(c.battery_buy_eur_kwh)??.25,sell=eh17N(c.battery_sell_eur_kwh)??.08,power=eh17N(c.battery_sim_power_kw)??3;
 const rows=data.rows,coverage=rows.filter(r=>Number.isFinite(r.import)&&Number.isFinite(r.export)).length;
 const ratesGood=coverage>=48&&rows.filter(r=>r.import!==null).every(r=>Number.isFinite(r.price));
 if(mode==='smart'&&!ratesGood)mode='solar';
 const profiles=[5,10,15].map(size=>eh21BatteryProfile(size,c));
 const results=profiles.map(p=>eh20Simulate(rows,p.capacity,eff,power,mode,buy,sell,p));
 const selected=results.find(r=>r?.capacity===cap),canShow=coverage>=48&&selected;
 const solarAlways=eh20Simulate(rows,cap,eff,power,'solar',buy,sell,eh21BatteryProfile(cap,c));
 const table=results.map((r,i)=>'<tr class="'+([5,10,15][i]===cap?'eh20-active':'')+'"><th scope="row"><button type="button" data-eh17-cap="'+[5,10,15][i]+'" aria-pressed="'+(cap===[5,10,15][i])+'">'+[5,10,15][i]+' kWh</button></th><td>'+(!r||coverage<48?'—':ehFmt(r.served,1)+' kWh')+'</td><td>'+(!r||coverage<48?'—':ehFmt(r.pvLimitedCapacity,1)+' kWh')+'</td><td>'+(!r||coverage<48?'—':ehEuro2(r.savings))+'</td></tr>').join('');
 const modes='<div class="eh20-modes" role="group" aria-label="Batterijlaadstrategie">'+
  '<button type="button" data-eh20-mode="solar" aria-pressed="'+(mode==='solar')+'" class="'+(mode==='solar'?'chosen':'')+'">Alleen zonne-overschot</button>'+
  '<button type="button" data-eh20-mode="smart" aria-pressed="'+(mode==='smart')+'" class="'+(mode==='smart'?'chosen':'')+'" '+(!ratesGood?'disabled title="Geen volledige historische uurprijzen"':'')+'>Zon + goedkoop netladen</button></div>';
 const batteryChoices=coverage>=48?'<div class="eh21-scenarios" aria-label="Batterijprofielen vergelijken">'+results.map(s=>{
  const chosen=s.capacity===cap,pct=Math.max(0,Math.min(100,s.peakSoc/s.usableCapacity*100));
  return '<button type="button" class="eh21-scenario '+(chosen?'chosen':'')+'" data-eh17-cap="'+s.capacity+'" aria-pressed="'+chosen+'">'+
  '<span class="eh21-label">'+s.capacity+' kWh <small>bruikbaar '+ehFmt(s.usableCapacity,1)+' kWh</small></span>'+
  '<span class="eh21-fill" role="img" aria-label="Piekvulling '+ehFmt(pct,0)+' procent"><span style="width:'+pct.toFixed(1)+'%"></span></span>'+
  '<span class="eh21-detail">Piek: '+ehFmt(s.peakSoc,1)+' kWh ('+ehFmt(pct,0)+'%)</span>'+
  '<span class="eh21-detail">Zon gemist door volle accu: '+ehFmt(s.pvLimitedCapacity,1)+' kWh</span>'+
  '<span class="eh21-detail">Netafname vermeden: '+ehFmt(s.served,1)+' kWh</span>'+
  '</button>';
 }).join('')+'</div>':'';
 const profileNote=canShow?'<p class="eh20-meta"><strong>'+cap+' kWh gekozen</strong> · bruikbare opslag '+ehFmt(selected.usableCapacity,1)+' kWh · laadlimiet '+ehFmt(selected.chargeKw,1)+' kW · ontlaadlimiet '+ehFmt(selected.dischargeKw,1)+' kW.</p>'+
  '<p class="eh20-meta">Van de theoretische teruglevering niet opgeslagen: '+ehFmt(selected.pvNotStored,1)+' kWh, waarvan '+ehFmt(selected.pvLimitedCapacity,1)+' kWh door een volle accu en '+ehFmt(selected.pvLimitedPower,1)+' kWh door beperkt laadvermogen.</p>':'';
 const essentiallyEqual=canShow&&Math.abs(results[2].served-results[0].served)<.05&&Math.abs(results[2].pvLimitedCapacity-results[0].pvLimitedCapacity)<.05;
 const equalityNote=essentiallyEqual?'<p class="eh20-notice">De capaciteiten geven in deze periode bijna dezelfde uitkomst. Het zonne-overschot, ontlaadmoment of laadvermogen kan de beperkende factor zijn; verschillen worden niet verzonnen.</p>':'';
 const chosenHour=eh23BatterySelectedHour(card,rows);
 const chosenDay=eh23BatteryDay(card,rows).day;
 const blocks=canShow?'<div class="eh20-kpis"><div><small>Vermeden netafname</small><strong>'+ehFmt(selected.served,1)+' kWh</strong></div>'+
  '<div><small>Opgeslagen zonne-energie (ingang)</small><strong>'+ehFmt(selected.pvCharge,1)+' kWh</strong></div>'+
  '<div><small>Netladen (ingang)</small><strong>'+ehFmt(selected.gridCharge,1)+' kWh</strong></div>'+
  '<div><small>Indicatieve kostendifferentie</small><strong>'+ehEuro2(selected.savings)+'</strong></div></div>'+
  eh23BatteryFlowChart(card,selected,rows)+
  '<details class="eh23-soc-details"><summary>Grafiek batterijvulling (SOC) over hele periode</summary>'+eh20Chart(selected,chosenHour)+'</details>':
  '<p class="eh20-notice">Te weinig betrouwbare P1-uren: minimaal 48 uur met beide energiestatistieken nodig. Geen bedragen berekend.</p>';
 const coverageText=coverage+' / '+rows.length+' uren met P1-data'+(ratesGood?' · historische uurprijzen beschikbaar':' · historische uurprijzen ontbreken of zijn onvolledig');
 const priceText=selected?.assumedPrices?'Financiële berekening gebruikt alleen instelbare aannames voor vermeden inkoop en gemiste teruglevering.':'Financiële berekening gebruikt geregistreerde uurprijzen voor vermeden afname en netladen; voor teruglevering geldt nog een vast aangenomen tarief.';
 const picked=chosenHour;
 const point=canShow?selected.points[picked]:null;
 const hourDetail=canShow?'<div class="eh20-hour-detail" aria-live="polite"><span>'+ehEsc(new Date(rows[picked].t).toLocaleString('nl-NL',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+'</span>'+
  '<strong>Accu: '+(point?.soc===null?'Geen uurgegevens':ehFmt(point.soc,2)+' kWh')+'</strong>'+
  '<small>Netafname '+ehEnergy(point?.import)+' · Teruglevering '+ehEnergy(point?.export)+'</small>'+
  '<small>PV-lading '+ehEnergy(point?.chargedSolar)+' · Netlading '+ehEnergy(point?.chargedGrid)+' · Ontladen '+ehEnergy(point?.discharged)+'</small>'+ '<small>Niet opgeslagen wegens vol '+ehEnergy(point?.fullRejected)+' · wegens laadlimiet '+ehEnergy(point?.powerRejected)+'</small>'+
  '<small>Historisch uurtarief '+(Number.isFinite(point?.price)?ehEuro2(point.price)+'/kWh':'niet beschikbaar')+'</small></div>':'';
 const hourPicker=canShow?'<label class="eh20-hour-picker"><span>Kies een uur op deze dag</span><input type="range" data-eh20-hour="1" min="'+chosenDay.indices[0]+'" max="'+chosenDay.indices[chosenDay.indices.length-1]+'" step="1" value="'+picked+'" aria-label="Kies uur van virtuele batterij"/></label>'+hourDetail:'';
 const eh26Summary=canShow?'<div class="eh26-overview"><div><small>Vermeden netafname · historie</small><strong>'+ehFmt(selected.served,1)+' kWh</strong></div>'+
  '<div><small>Zonnestroom opgeslagen · historie</small><strong>'+ehFmt(selected.pvCharge,1)+' kWh</strong></div>'+
  '<div><small>Indicatieve besparing · historie</small><strong>'+ehEuro2(selected.savings)+'</strong></div></div>':'';
 const eh26Tab=['today','history','returns','compare'].includes(card._eh26Tab)?card._eh26Tab:'today';
 const eh26History='<div class="eh26-panel eh26-history" '+(eh26Tab==='history'?'':'hidden')+'>'+blocks+hourPicker+'</div>';
 const eh26Today='<div class="eh26-panel" '+(eh26Tab==='today'?'':'hidden')+'>'+eh26ForecastHtml(h,c,cap,selected?.chargeKw||power,mode,new Date(),card)+'</div>';
 const eh26Returns='<div class="eh26-panel" '+(eh26Tab==='returns'?'':'hidden')+'>'+eh22BatteryFinancialHtml(card,results,rows,cap)+
  '<details class="eh26-advanced"'+(card._eh26AdvancedOpen?' open':'')+'><summary>Capaciteiten, simulatiegegevens en aannames</summary>'+eh25AuditHtml(card,h,c,rows)+
  '<details class="eh23-profiles"><summary>Details van 5, 10 en 15 kWh vergelijken</summary>'+batteryChoices+'</details>'+
  '<div class="eh20-table-wrap"><table class="eh20-table"><caption>Uurmodel bij '+ehEsc(mode==='smart'?'zon en goedkoop netladen':'alleen zonneladen')+'</caption><thead><tr><th>Capaciteit</th><th>Vermeden afname</th><th>Niet opgeslagen: vol</th><th>Indicatieve besparing</th></tr></thead><tbody>'+table+'</tbody></table></div></details></div>';
 const modeText=mode==='smart'?'Goedkope-urenregel op basis van historisch goedkoopste kwartiel en volgende 24 uur; dit is een terugkijkende scenario-aanname met perfecte kennis, geen uitvoerbaar laadplan. Het daadwerkelijke piekvermogen op de 1×40A-aansluiting is hiermee niet gecontroleerd.':'Alleen zonnestroom die anders zou zijn teruggeleverd wordt theoretisch opgeslagen.';
 const delta=canShow&&mode==='smart'&&solarAlways?ehEuro2(selected.savings-solarAlways.savings):null;
 return '<section class="subsection eh20-panel" aria-label="Batterij Simulator 3.0">'+
  '<h3>'+ehIcon('battery')+' Batterij · inzicht en verwachting</h3>'+
  eh26Summary+eh30PersonalEvidenceHtml(rows)+
  modes+'<div class="eh23-cap-tabs" role="group" aria-label="Selecteer virtuele batterijcapaciteit">'+[5,10,15].map(n=>'<button type="button" data-eh17-cap="'+n+'" aria-pressed="'+(cap===n)+'" class="'+(cap===n?'chosen':'')+'">'+n+' kWh</button>').join('')+'</div>'+
  eh26BatteryTabs(card)+eh26Today+eh26History+
  '<div class="eh26-panel" '+(eh26Tab==='returns'?'':'hidden')+'>'+eh22BatteryPeriodControls(card)+profileNote+equalityNote+eh26Returns+
  (delta?'<p class="eh20-meta">Verschil met alleen zonneladen bij '+cap+' kWh: <strong>'+delta+'</strong> over beschikbare uren.</p>':'')+
  '<details class="eh32-model"><summary>Bronnen en rekenaannames</summary><p class="eh20-meta">'+ehEsc(modeText)+'</p>'+
  '<p class="eh20-meta">'+ehEsc(priceText)+' Dit zijn scenarioresultaten, geen maandprognoses of gerealiseerde eurobesparingen.</p>'+
  '<p class="eh20-meta">Aannames: '+ehFmt(eff*100,0)+'% rondrendement; laad-/ontlaadlimiet '+ehFmt(power,1)+' kW. '+ehEuro2(buy)+'/kWh inkoopreferentie en '+ehEuro2(sell)+'/kWh terugleververgoeding. Geen garantie voor jouw 1×40 A-aansluiting, tarieven, pieken of batterijlevensduur.</p>'+
  baseNote+'</details></div></section>';
}
function eh20Css(){
 return '.eh25-audit{margin:13px 0;padding:12px;border:1px solid #86a7b45c;border-radius:11px;background:#0b293b}.eh25-audit summary{font-size:13px;font-weight:700;cursor:pointer}.eh25-audit p{font-size:12px;color:#c8e1eb;line-height:1.45;margin:8px 0}.eh25-audit p.eh25-small{font-size:11px;color:#b3cfd9}.eh25-audit button{font:inherit;font-size:12px;min-height:42px;padding:8px 12px;background:#17435a;color:#ecfaff;border:1px solid #91b5c2;border-radius:9px;cursor:pointer}.eh25-audit button:disabled{opacity:.5;cursor:default}.eh25-audit-result{border-top:1px solid #90b5bf55;margin-top:10px;padding-top:6px}.eh24-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:10px 0}.eh24-tabs button{font:inherit;font-size:12px;border-radius:9px;min-height:40px;border:1px solid #7595a9;background:#143447;color:#e5f2f7;cursor:pointer}.eh24-tabs button.selected{background:#5d2e86;color:#fff;border-color:#c687f2;font-weight:700}.eh24-tabs button:disabled{opacity:.42;cursor:not-allowed}.eh24-combined-svg{max-height:270px}.eh24-combined-svg [data-eh23-hour],.eh24-combined-svg [data-eh24-day]{cursor:pointer}.eh24-combined-svg [data-eh23-hour]:focus,.eh24-combined-svg [data-eh24-day]:focus{stroke:white;stroke-width:1.5}.eh23-legend .eh24-purple{background:#b84bea}.eh23-legend .eh24-lilac{background:#8580e8}.eh23-legend .eh24-green{background:#31c78e}.eh23-legend .eh24-soc{background:transparent;border-top:2px dashed white;height:0;width:13px;border-radius:0}.eh23-battery-page{min-width:0}.eh23-battery-page .eh20-panel{margin-top:2px}.eh23-battery-page .eh20-kpis{margin:12px 0}.eh23-battery-page .eh20-meta{line-height:1.5}.eh23-cap-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:12px 0}.eh23-cap-tabs button{font:inherit;font-size:13px;font-weight:700;min-height:43px;color:#d7f1f6;background:#102f41;border:1px solid #779aaf;border-radius:10px;cursor:pointer}.eh23-cap-tabs button.chosen{background:#195640;border-color:#54ddb0;color:#fff}.eh23-day-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:10px 0}.eh23-day-nav strong{font-size:12px;text-align:center;min-width:0}.eh23-day-nav button{font:inherit;font-weight:700;font-size:22px;min-width:42px;min-height:40px;background:#12394b;color:#fff;border-radius:9px;border:1px solid #87b2c3;cursor:pointer}.eh23-day-nav button:disabled{opacity:.32;cursor:default}.eh23-flow{margin:13px 0;background:#0b2939;border:1px solid #58839670;border-radius:13px;padding:11px;min-width:0}.eh23-flow-head{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap}.eh23-flow-head h4{font-size:14px;margin:0}.eh23-flow-head small{color:#9bc3d2;font-size:10px}.eh23-legend{display:flex;gap:7px 12px;flex-wrap:wrap;font-size:10px;color:#b6d3df;margin:9px 0}.eh23-legend span{display:flex;gap:4px;align-items:center}.eh23-legend i{height:9px;width:9px;display:block;border-radius:2px}.eh23-solar{background:#47d9a5}.eh23-grid{background:#69acfa}.eh23-out{background:#ffbf77}.eh23-no-data{background:#8091a2}.eh23-flow-svg{display:block;width:100%;height:auto;max-height:200px;overflow:visible}.eh23-flow-svg [data-eh23-hour]{cursor:pointer}.eh23-flow-svg [data-eh23-hour]:focus{outline:none;stroke:#fff;stroke-width:1}.eh23-flow-totals{font-size:11px;color:#d8ebf2;line-height:1.5;margin:5px 0 0}.eh23-advanced,.eh23-profiles,.eh23-soc-details{border:1px solid #7ca1b64d;border-radius:10px;margin:12px 0;padding:10px 12px;background:#0a223233;min-width:0}.eh23-advanced summary,.eh23-profiles summary,.eh23-soc-details summary{font-size:12px;font-weight:700;color:#c5e5f2;cursor:pointer;padding:3px}.eh23-legacy-content>.subpage-head{display:none}.eh23-advanced .eh17-panel{margin-top:12px}.eh23-advanced .subgrid{margin-top:12px}.eh22-periods{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.eh22-periods button{min-height:40px;border:1px solid #668ea4;background:#102d40;color:#e8f7ff;border-radius:9px;padding:9px 14px;cursor:pointer}.eh22-periods button.chosen{background:#18533e;border-color:#61dfb4}.eh22-finance{margin-top:14px;border-top:1px solid #779ab24b;padding-top:13px}.eh22-finance h3{font-size:16px}.eh22-ledger{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:12px 0}.eh22-ledger>div{display:flex;flex-direction:column;gap:6px;background:#0a2638;border:1px solid #7cacc02e;border-radius:10px;padding:11px;min-width:0}.eh22-ledger strong{font-size:17px}.eh22-ledger small{font-size:11px;color:#afd0de}.eh22-inputs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:10px 0}.eh22-inputs label{display:flex;flex-direction:column;gap:6px;font-size:11px;color:#c3deea}.eh22-inputs input{min-width:0;width:100%;box-sizing:border-box;border:1px solid #779ab2;border-radius:8px;padding:10px;background:#0b293b;color:#fff;font:inherit;font-size:16px}.eh22-payback{border-left:3px solid #54dbb1;padding:9px 12px;font-size:12px;color:#dcf7ec;background:#1e51332b}@media(max-width:460px){.eh22-inputs{grid-template-columns:1fr}.eh22-ledger strong{font-size:15px}}.eh21-scenarios{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}.eh21-scenario{font:inherit;text-align:left;background:#0b2a39;color:#e6f5fc;border:1px solid #7c9faf63;border-radius:12px;padding:11px;display:flex;flex-direction:column;gap:8px;min-width:0;cursor:pointer}.eh21-scenario.chosen{border-color:#4bdda9;background:#18473e}.eh21-scenario:focus-visible,.eh20-table button:focus-visible{outline:2px solid #fff;outline-offset:2px}.eh21-label{display:flex;flex-wrap:wrap;gap:4px;justify-content:space-between;font-weight:750;font-size:14px}.eh21-label small{font-size:10px;color:#abcbd7;font-weight:500}.eh21-fill{height:13px;border-radius:4px;border:1px solid #95c3d46a;background:#081b29;overflow:hidden}.eh21-fill>span{display:block;height:100%;background:#4fdbad}.eh21-detail{font-size:10px;line-height:1.45;color:#c4dce7}.eh20-table button{border:1px solid #8bb4cb;background:#103747;color:#ecfff5;border-radius:7px;padding:7px;cursor:pointer}@media(max-width:550px){.eh21-scenarios{grid-template-columns:1fr}.eh21-scenario{gap:6px}}.eh20-hour-picker{display:flex;flex-direction:column;gap:6px;color:#c7e1ed;font-size:11px;margin:11px 0}.eh20-hour-picker input{width:100%;accent-color:#56e4b5}.eh20-hour-detail{background:#092638;border:1px solid #91b8cb44;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:5px}.eh20-hour-detail span{color:#b4d2e0;font-size:11px}.eh20-hour-detail strong{font-size:15px}.eh20-hour-detail small{font-size:11px;color:#bad4e2;line-height:1.5}.eh20-panel{margin-top:13px}.eh20-panel h3{margin:0 0 12px;font-size:16px;display:flex;align-items:center;gap:7px}.eh20-panel h3 .icon{width:19px;height:19px;color:#54e8b7}.eh20-meta{color:#b8d1dd;font-size:11px;line-height:1.5;margin:9px 0}.eh20-modes{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.eh20-modes button{font:inherit;font-size:12px;background:#0c2b3f;border:1px solid #668ea45c;color:#d9eff9;border-radius:9px;padding:10px;cursor:pointer}.eh20-modes button.chosen{background:#17523f;border-color:#5fe1b7}.eh20-modes button:disabled{opacity:.48;cursor:not-allowed}.eh20-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.eh20-kpis>div{min-width:0;background:#0a2638;border:1px solid #7cacc02e;padding:12px;border-radius:11px;display:flex;flex-direction:column;gap:7px}.eh20-kpis small{font-size:11px;color:#afd0de}.eh20-kpis strong{font-size:19px;overflow-wrap:anywhere}.eh20-notice{padding:10px 12px;border-left:3px solid #eabb78;background:#5a3d251e;color:#ffd8ae;font-size:12px}.eh20-soc-chart{width:100%;height:auto;max-height:170px;margin:15px 0;display:block}.eh20-table-wrap{overflow-x:auto}.eh20-table{width:100%;border-collapse:collapse;font-size:12px;min-width:320px}.eh20-table caption{text-align:left;color:#a6c8d5;font-size:11px;margin-bottom:6px}.eh20-table td,.eh20-table th{border-bottom:1px solid #8cb5cb30;padding:9px 7px;text-align:left}.eh20-table .eh20-active{background:#194b3c5e;color:#cdfcec}@media(max-width:440px){.eh20-kpis strong{font-size:16px}.eh20-modes button{flex:1;font-size:11px;padding:10px 6px}}';
}
(function eh20Install(){
 const P=EnergiehuisCard.prototype,originalBattery=P._batteryHtml,originalRender=P._render,originalConfig=P.setConfig;
 P.setConfig=function(config){
  this._eh25Request=(this._eh25Request||0)+1;this._eh25Audit=null;this._eh25Loading=false;this._eh25Error='';this._eh25Open=false;
  this._eh20Battery=null;
  this._eh20Loading=false;
  this._eh20Request=(this._eh20Request||0)+1;
  return originalConfig.call(this,config);
 };
 P._eh20LoadBattery=async function(){
  const c=this.config,h=this._hass;
  if(!this.isConnected||!h?.callWS||!c?.import||!c?.export||this._eh20Loading)return;
  this._eh20Loading=true;
  const request=this._eh20Request=(this._eh20Request||0)+1;
  const days=this._eh22Days===30?30:7;
  const lim=eh20Limits(new Date(),days),ids=[c.import,c.export];
  const priceId=c.prijs;
  try{
   const energy=await h.callWS({type:'recorder/statistics_during_period',start_time:lim.from.toISOString(),end_time:lim.to.toISOString(),statistic_ids:ids,period:'hour',types:['change','sum']});
   const taskPrice=priceId?Promise.allSettled([
    h.callWS({type:'recorder/statistics_during_period',start_time:lim.from.toISOString(),end_time:lim.to.toISOString(),statistic_ids:[priceId],period:'hour',types:['mean']}),
    h.callWS({type:'history/history_during_period',start_time:lim.from.toISOString(),end_time:lim.to.toISOString(),entity_ids:[priceId],minimal_response:true,no_attributes:true,significant_changes_only:false})
   ]):Promise.resolve([]);
   const priceResults=await taskPrice;
   const bins=eh24BatteryWindows(lim);
   const priceStats=priceResults[0]?.status==='fulfilled'?priceResults[0].value:null;
   const history=priceResults[1]?.status==='fulfilled'?priceResults[1].value:null;
   const prices=eh20HourlyPrices(priceStats,history,bins,priceId,h);
   const out=eh20HourlyRows(energy,c,h,lim,prices);
   if(request===this._eh20Request)this._eh20Battery={at:Date.now(),rows:out.rows,error:out.error,days};
  }catch(_){
   if(request===this._eh20Request)this._eh20Battery={at:Date.now(),rows:[],days,error:'Recorder-uurstatistieken ontbreken. Controleer P1-statistieken, entiteiten en toegang tot Recorder.'};
  }finally{if(request===this._eh20Request){this._eh20Loading=false;if(this.isConnected)this._schedule();}}
 };

 P._eh25LoadAudit=async function(){
  const h=this._hass,c=this.config;
  if(this._eh25Loading||!this.isConnected||!h?.callWS||!c?.import||!c?.export)return;
  this._eh25Loading=true;this._eh25Error='';this._eh25Open=true;
  const request=this._eh25Request=(this._eh25Request||0)+1;
  const n=new Date(),today=new Date(n.getFullYear(),n.getMonth(),n.getDate());
  const yesterday=new Date(n.getFullYear(),n.getMonth(),n.getDate()-1);
  const yearFrom=new Date(n.getFullYear()-1,n.getMonth(),n.getDate()-7);
  const yearTo=new Date(n.getFullYear()-1,n.getMonth(),n.getDate());
  const ids=[c.import,c.export];
  const read=(a,b,period)=>h.callWS({type:'recorder/statistics_during_period',start_time:a.toISOString(),
   end_time:b.toISOString(),statistic_ids:ids,period,types:['change','sum']});
  if(this.isConnected)this._schedule();
  try{
   const [five,old]=await Promise.allSettled([read(yesterday,today,'5minute'),read(yearFrom,yearTo,'hour')]);
   if(request!==this._eh25Request)return;
   this._eh25Audit={
    five:five.status==='fulfilled'?eh25ProbeCoverage(five.value,ids,yesterday.getTime(),today.getTime(),5):null,
    old:old.status==='fulfilled'?eh25ProbeCoverage(old.value,ids,yearFrom.getTime(),yearTo.getTime(),60):null,
    fiveError:five.status==='rejected'?'Geen toegang tot vijfminutenstatistieken.':'',
    oldError:old.status==='rejected'?'Geen toegang tot oudere uurstatistieken.':''
   };
  }catch(_){if(request===this._eh25Request)this._eh25Error='Recorder-datacontrole is niet gelukt.';}
  finally{if(request===this._eh25Request){this._eh25Loading=false;if(this.isConnected)this._schedule();}}
 };
 P._batteryHtml=function(h,c){
  const legacy=originalBattery.call(this,h,c);
  if(!legacy.startsWith('<main class="subpage">')||!legacy.endsWith('</main>'))return legacy.replace('</main>',eh20BatteryView(this,h,c)+'</main>');
  const advanced=legacy.replace(/^<main class="subpage">/,'<div class="eh23-legacy-content">').replace(/<\/main>$/,'</div>');
  return '<main class="subpage eh23-battery-page"><div class="subpage-head"><div><div class="eyebrow">Virtuele batterij · scenario</div><h2>Batterij</h2><p>Gesimuleerde laad- en ontlaadmomenten op basis van jouw P1-uren. Geen fysieke thuisbatterijmetingen.</p></div></div>'+
   eh20BatteryView(this,h,c)+
   '<details class="eh23-advanced"><summary>Oudere 10-kWh- en dagtotalenberekeningen bekijken</summary>'+advanced+'</details></main>';
 };
 P._render=function(){
  originalRender.call(this);
  const root=this.shadowRoot;
  if(!root||!this.config||!this._hass)return;
  const style=root.querySelector?.('style');
  if(style&&!style.textContent.includes('.eh20-panel{'))style.textContent+='\n'+eh20Css()+'\n'+eh26BatteryCss();
  if(this._eh20Events)return;
  this._eh20Events=true;
  root.addEventListener('change',e=>{
   const input=e.target;
   if(input?.matches?.('[data-eh22-invest],[data-eh22-wear]')){
    const raw=String(input.value??'').trim(),n=raw===''?null:Number(raw);
    const invest=input.hasAttribute('data-eh22-invest'),cap=Number(input.dataset.eh22Invest);
    const valid=n===null||(Number.isFinite(n)&&(invest?n>0&&n<=100000:n>=0&&n<=.5));
    if(!valid){this._eh22Error=invest?'Aanschafkosten moeten tussen €1 en €100.000 liggen.':'Slijtagekosten moeten tussen €0 en €0,50/kWh liggen.';}
    else{this._eh22Error='';if(invest){if(!this._eh22Investments)this._eh22Investments={};this._eh22Investments[cap]=n;}else this._eh22Wear=n;}
    this._schedule();
   }
  });
  root.addEventListener('input',e=>{
   const input=e.target;
   if(input?.matches?.('[data-eh22-invest],[data-eh22-wear]')){
    const invest=input.hasAttribute('data-eh22-invest'),raw=String(input.value??'').trim();
    const n=raw===''?null:Number(raw),cap=Number(input.dataset.eh22Invest);
    const valid=n===null||(Number.isFinite(n)&&(invest?n>0&&n<=100000:n>=0&&n<=.5));
    if(valid){
     if(invest&&[5,10,15].includes(cap)){if(!this._eh22Investments)this._eh22Investments={};this._eh22Investments[cap]=n;}
     if(!invest)this._eh22Wear=n;
    }
    // No render while typing: keep focus and avoid losing edits.
    return;
   }
   if(!input?.matches?.('[data-eh20-hour]'))return;
   const n=Number(input.value);
   if(Number.isInteger(n)&&n>=0){this._eh20Selected=n;this._schedule();}
  });
  root.addEventListener('keydown',e=>{
   if(e.key!=='Enter'&&e.key!==' ')return;
   if(e.target?.matches?.('[data-eh23-hour]')){e.preventDefault();this._eh20Selected=Number(e.target.dataset.eh23Hour);this._schedule();}
   if(e.target?.matches?.('[data-eh24-day]')){e.preventDefault();this._eh23DayIndex=Number(e.target.dataset.eh24Day);this._eh24GraphPeriod='day';this._eh20Selected=null;this._schedule();}
   if(e.target?.matches?.('[data-eh27-price-hour]')){e.preventDefault();this._eh27ForecastIndex=Number(e.target.dataset.eh27PriceHour);this._schedule();}
  });
  root.addEventListener('click',e=>{
   const pricePoint=e.target?.closest?.('[data-eh27-price-hour]');
   if(pricePoint){this._eh27ForecastIndex=Number(pricePoint.dataset.eh27PriceHour);this._schedule();return;}
   const newTab=e.target?.closest?.('[data-eh26-tab]');
   if(newTab){
    const key=newTab.dataset.eh26Tab;
    if(['today','history','returns','compare'].includes(key)){this._eh26Tab=key;this._schedule();}return;
   }
   const detailSummary=e.target?.closest?.('.eh26-advanced summary');
   if(detailSummary){this._eh26AdvancedOpen=!detailSummary.parentElement.open;return;}
   const auditSummary=e.target?.closest?.('.eh25-audit summary');
   if(auditSummary){this._eh25Open=!auditSummary.parentElement.open;return;}
   const audit=e.target?.closest?.('[data-eh25-probe]');
   if(audit){if(!audit.disabled)this._eh25LoadAudit();return;}
   const graphView=e.target?.closest?.('[data-eh24-view]');
   if(graphView&&!graphView.disabled){
    const next=graphView.dataset.eh24View;
    if(['day','week','month'].includes(next)){
     this._eh24GraphPeriod=next;this._eh20Selected=null;
     if(next==='month'&&this._eh22Days!==30){
      this._eh22Days=30;this._eh20Request=(this._eh20Request||0)+1;this._eh20Battery=null;
      this._eh20Loading=false;this._eh23DayIndex=null;this._eh20LoadBattery();
     }
     this._schedule();return;
    }
   }
   const daily=e.target?.closest?.('[data-eh24-day]');
   if(daily){this._eh23DayIndex=Number(daily.dataset.eh24Day);this._eh24GraphPeriod='day';this._eh20Selected=null;this._schedule();return;}
   const hour=e.target?.closest?.('[data-eh23-hour]');
   if(hour){this._eh20Selected=Number(hour.dataset.eh23Hour);this._schedule();return;}
   const stepButton=e.target?.closest?.('[data-eh23-step]');
   if(stepButton&&!stepButton.disabled){
    const d=eh23BatteryDays(this._eh20Battery?.rows||[]);const current=Number.isInteger(this._eh23DayIndex)?this._eh23DayIndex:d.length-1;
    this._eh23DayIndex=Math.max(0,Math.min(d.length-1,current+Number(stepButton.dataset.eh23Step)));
    this._eh20Selected=null;this._schedule();return;
   }
   const period=e.target?.closest?.('[data-eh22-period]');
   if(period){const days=Number(period.dataset.eh22Period);if((days===7||days===30)&&days!==(this._eh22Days===30?30:7)){this._eh22Days=days;this._eh20Request=(this._eh20Request||0)+1;this._eh20Battery=null;this._eh20Loading=false;this._eh20Selected=null;this._eh23DayIndex=null;this._eh20LoadBattery();this._schedule();}return;}
   const btn=e.target?.closest?.('[data-eh20-mode]');
   if(!btn||btn.disabled)return;
   const mode=btn.dataset.eh20Mode;
   if(mode==='solar'||mode==='smart'){this._eh20Mode=mode;this._schedule();}
  });
 };
})();

