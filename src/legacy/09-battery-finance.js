/* Battery 4.0: finance is a read-only scenario over exactly the simulated hour rows.
   Capex is never inferred from a battery capacity or hidden in the savings model. */
/* Personal comparison foundation: report evidence, never infer appliance use from P1. */
function eh30PersonalEvidenceHtml(rows){
 const q=eh30PersonalEvidence(rows);
 const period=q.start===null?'Geen meetperiode':new Date(q.start).toLocaleDateString('nl-NL')+' – '+new Date(q.end-1).toLocaleDateString('nl-NL');
 return '<div class="eh32-quality"><span class="eh32-coverage" aria-label="Meetdekking">'+ehFmt(q.coverage*100,0)+'% · '+q.valid+' / '+q.expected+' uren</span><details class="eh30-evidence" aria-label="Persoonlijke meetbasis"><summary>Datakwaliteit</summary><h4>Jouw meetbasis · batterijvergelijker</h4>'+
 '<p class="eh20-meta">'+ehEsc(period)+' · '+q.valid+' / '+q.expected+' uur bruikbare P1-data · '+ehFmt(q.coverage*100,0)+'% dekking</p>'+
 '<div class="eh20-kpis"><div><small>Gemeten netafname</small><strong>'+ehFmt(q.imported,1)+' kWh</strong></div><div><small>Gemeten teruglevering</small><strong>'+ehFmt(q.exported,1)+' kWh</strong></div></div>'+
 '<p class="eh20-meta">Historische inkoopprijzen: '+q.priced+' / '+q.valid+' bruikbare uren. Ontbrekende of ongeldige uren: '+q.missing+'. Dubbele tijdstippen: '+q.duplicates+'. Netafname omvat ook de Cupra; huishoudelijk verbruik en PV-opwek zijn hier niet afzonderlijk vastgesteld.</p>'+
 '<p class="eh20-notice">Nog geen persoonlijk aankoopadvies. De huidige vergelijking gebruikt maximaal 30 dagen en generieke capaciteiten. Een betrouwbare jaarverwachting vereist een volledig seizoensprofiel, gecontroleerde contracttarieven en productgegevens.</p>'+
 '<details class="eh30-evidence-details"><summary>Wat ontbreekt voor een betrouwbare keuze?</summary><ul>'+
 '<li>Gekoppelde Alfen-laadhistorie en een gelijke laadbehoefte voor de Cupra in alle scenario’s.</li>'+
 '<li>Historische inkoop én terugleverprijzen met belastingen, toeslagen en contractregels.</li>'+
 '<li>Productspecificaties, installatieofferte, vaste kosten, standbyverbruik, degradatie en garantie.</li>'+
 '<li>Vermogenscontrole voor de 1×40 A-aansluiting; uurdata bewijzen geen veilige piekbelasting.</li>'+
 '<li>Vergelijking met geen batterij en slim autoladen; terugkijkend slim laden is een theoretisch scenario.</li>'+
 '</ul><p class="eh20-meta">Ook volledige meetdekking bewijst geen juiste sensoren of representatief jaar. Dit overzicht beoordeelt de beschikbare rijen; de gegevens zijn niet onafhankelijk gevalideerd.</p></details></details></div>';
}
function eh22BatteryCoverage(rows){
 const hourRows=Array.isArray(rows)?rows:[];
 const groups=new Map();
 for(const r of hourRows){
  if(!Number.isFinite(r?.t))continue;
  const day=new Date(r.t),key=day.getFullYear()+'-'+(day.getMonth()+1)+'-'+day.getDate();
  const entry=groups.get(key)||{expected:0,valid:0};
  entry.expected++;
  if(Number.isFinite(r.import)&&r.import>=0&&Number.isFinite(r.export)&&r.export>=0)entry.valid++;
  groups.set(key,entry);
 }
 const valid=[...groups.values()].reduce((sum,d)=>sum+d.valid,0);
 return {hours:hourRows.length,validHours:valid,coverage:hourRows.length?valid/hourRows.length:0,
  completeDays:[...groups.values()].filter(d=>d.expected>=23&&d.expected<=25&&d.valid===d.expected).length};
}
function eh22BatteryFinance(simulation,rows,days,investment,wear){
 const health=eh22BatteryCoverage(rows);
 if(!simulation||health.validHours<48)return {available:false,health};
 const capex=Number.isFinite(investment)&&investment>0&&investment<=100000?investment:null;
 const wearRate=Number.isFinite(wear)&&wear>=0&&wear<=.5?wear:null;
 const wearTotal=wearRate===null?null:simulation.served*wearRate;
 const operating=simulation.savings;
 const afterWear=wearTotal===null?null:operating-wearTotal;
 const repeatable=days===30&&health.coverage>=.9&&health.completeDays>=21;
 const annualIllustration=repeatable?(afterWear===null?operating:afterWear)*365/30:null;
 const payback=capex!==null&&wearRate!==null&&annualIllustration>0?capex/annualIllustration:null;
 return {available:true,health,capex,wearRate,wearTotal,operating,afterWear,
  annualIllustration,payback,cycles:simulation.usableCapacity>0?simulation.served/simulation.usableCapacity:null};
}
function eh22BatteryPeriodControls(card){
 const period=card._eh22Days===30?30:7;
 return '<div class="eh22-periods" role="group" aria-label="Historische batterijperiode">'+
  [7,30].map(days=>'<button type="button" data-eh22-period="'+days+'" aria-pressed="'+(days===period)+'" class="'+(days===period?'chosen':'')+'">'+days+' dagen</button>').join('')+
  '</div>';
}
function eh22BatteryFinancialHtml(card,results,rows,selectedCap){
 const days=card._eh22Days===30?30:7,wear=card._eh22Wear;
 const investments=card._eh22Investments||{};
 const value=Number.isFinite(investments[selectedCap])?investments[selectedCap]:null;
 const finances=(results||[]).map(r=>eh22BatteryFinance(r,rows,days,investments[r?.capacity],wear));
 const selected=finances[[5,10,15].indexOf(selectedCap)];
 if(!selected?.available)return '<section class="eh22-finance"><h3>Financiële simulatie</h3><p class="eh20-notice">Niet genoeg betrouwbare P1-uren voor een financiële vergelijking. Er verschijnen geen verzonnen besparingen.</p></section>';
 const f=selected,quality=f.health,illustration=f.annualIllustration;
 const display=n=>Number.isFinite(n)?ehEuro2(n):'—';
 const table=results.map((r,i)=>{
  const x=finances[i];
  return '<tr'+(r?.capacity===selectedCap?' class="eh20-active"':'')+'><th scope="row">'+(r?.capacity||[5,10,15][i])+' kWh</th>'+
   '<td>'+display(x.operating)+'</td><td>'+display(x.afterWear)+'</td>'+
   '<td>'+(Number.isFinite(x.cycles)?ehFmt(x.cycles,1):'—')+'</td></tr>';
 }).join('');
 const maxBar=Math.max(.01,...finances.filter(x=>Number.isFinite(x?.operating)).map(x=>Math.abs(x.operating)));
 const capChart='<div class="eh27-finance-chart"><h4>Operationeel voordeel per capaciteit</h4><svg viewBox="0 0 410 168" role="img" aria-label="Scenariovergelijking 5 10 en 15 kilowattuur">'+
 '<line x1="167" x2="167" y1="10" y2="150" stroke="#8caab9" stroke-width="1.4"/>'+finances.map((x,i)=>{
  const cap=[5,10,15][i],v=x?.operating,known=Number.isFinite(v),y=15+i*48,w=known?Math.abs(v)/maxBar*174:0;
  return '<text x="8" y="'+(y+21)+'" font-size="16" fill="#cce8ef">'+cap+' kWh</text>'+
   (known?'<rect x="'+(v>=0?167:(167-w)).toFixed(2)+'" y="'+y+'" width="'+Math.max(.5,w).toFixed(2)+'" height="28" rx="6" fill="'+(cap===selectedCap?'#41daa6':'#287f88')+'"><title>'+ehEsc(cap+' kWh · '+display(v))+'</title></rect>':'')+
   '<text x="375" y="'+(y+21)+'" font-size="15" fill="#e5f9f5" text-anchor="end">'+ehEsc(display(v))+'</text>';
 }).join('')+'</svg><small>Historisch simulatievoordeel, exclusief aanschafkosten</small></div>';
 const note=f.payback!==null?'Illustratieve terugverdientijd bij herhaling van deze periode: '+ehFmt(f.payback,1)+' jaar.':f.capex===null?
  'Vul een aanschafprijs in om een terugverdientijd te kunnen beoordelen.':f.wearRate===null?
  'Vul eerst een aangenomen slijtagekost in voor een terugverdientijd na slijtage.':
  illustration===null?'Een terugverdientijd vereist minimaal 21 complete meetdagen en 90% uurdekking in de 30-dagenperiode.':
  'Geen positieve terugverdientijd bij deze aannames.';
 return '<section class="eh22-finance" aria-label="Financiële batterijsimulatie">'+
  '<h3>'+ehIcon('euro')+' Batterij 4.0 · financiële vergelijking</h3>'+
  '<p class="eh20-meta">Alleen de gekozen '+days+' volledige kalenderdagen: '+quality.validHours+' / '+quality.hours+' meeturen · '+quality.completeDays+' complete dagen. '+
  'Dit is geen kalendermaandprognose.</p>'+
  '<div class="eh22-ledger">'+
  '<div><small>Vermeden inkoop</small><strong>'+display(results[[5,10,15].indexOf(selectedCap)].avoidedPurchase)+'</strong></div>'+
  '<div><small>Kosten netladen</small><strong>'+display(results[[5,10,15].indexOf(selectedCap)].gridPurchase)+'</strong></div>'+
  '<div><small>Gemiste teruglevering</small><strong>'+display(results[[5,10,15].indexOf(selectedCap)].lostExport)+'</strong></div>'+
  '<div><small>Operationeel voordeel</small><strong>'+display(f.operating)+'</strong></div></div>'+
  capChart+'<details class="eh27-finance-more"><summary>Investering, slijtage en berekeningsdetails</summary>'+'<div class="eh22-inputs"><label>Aanschaf + installatie '+selectedCap+' kWh (€)<input type="number" data-eh22-invest="'+selectedCap+'" min="1" max="100000" step="10" inputmode="decimal" placeholder="Niet ingevuld" value="'+(value===null?'':value)+'"></label>'+
  '<label>Slijtagekosten (€/ontladen kWh)<input type="number" data-eh22-wear="1" min="0" max="0.5" step="0.01" inputmode="decimal" placeholder="Niet meegerekend" value="'+(Number.isFinite(wear)?wear:'')+'"></label></div>'+
  (card._eh22Error?'<p class="eh20-notice" role="alert">'+ehEsc(card._eh22Error)+'</p>':'')+
  '<div class="eh20-table-wrap"><table class="eh20-table"><caption>Alle capaciteiten op dezelfde P1-uurhistorie, exclusief aanschafkosten</caption><thead><tr><th>Accu</th><th>Operationeel</th><th>Na slijtage</th><th>Equivalent cycli*</th></tr></thead><tbody>'+table+'</tbody></table></div>'+
  '<p class="eh20-meta">* Doorzet: vermeden netafname gedeeld door bruikbare accucapaciteit; vereenvoudigde cyclusindicator.</p>'+
  '<p class="eh22-payback">'+ehEsc(note)+'</p>'+
  (illustration===null?'<p class="subtle">Een jaarscenario wordt pas getoond bij voldoende 30-dagenhistorie.</p>':
   '<p class="subtle">Als deze 30 dagen zich 365 dagen identiek zouden herhalen: '+display(illustration)+' voordeel per jaar'+(f.afterWear!==null?' na slijtage':' zonder slijtagekosten')+'. Dit is een hypothetische extrapolatie, géén jaarprognose: seizoen, zon, tarieven, degradatie en batterijgarantie zijn niet gemodelleerd.</p>')+
  '<p class="subtle">Prijzen volgen de huidige simulatie: '+(results[[5,10,15].indexOf(selectedCap)].assumedPrices?
   'historische uurtarieven ontbreken, dus de ingestelde inkoopaanname wordt gebruikt.':
   'voor inkoop zijn historische uurprijzen gebruikt.')+
  ' Terugleververgoeding is een vaste aanname; netbeheerkosten, saldering, terugleverkosten, batterijafschrijving en belastingwijzigingen kunnen verschillen. Invoer blijft alleen tijdens deze sessie in de kaart.</p></details></section>';
}

