/* Personal battery comparison: imported HomeWizard counters stay in this card's
   memory. Calendar labels use Europe/Amsterdam; simulations use absolute time. */
const EH31_SETTINGS_KEY='energiehuis:battery-comparison:v1';
const EH31_COUNTERS=['Import T1 kWh','Import T2 kWh','Export T1 kWh','Export T2 kWh'];
const EH31_ZONE=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function eh31Wall(t){return EH31_ZONE.format(new Date(t)).replace(',','');}
function eh31Time(label,after=-Infinity){
 const m=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(label);
 if(!m)return null;
 const y=+m[1],mo=+m[2],d=+m[3],h=+m[4],mi=+m[5];
 if(y<2000||y>2100||mo<1||mo>12||d<1||d>31||h>23||mi>59)return null;
 const base=Date.UTC(y,mo-1,d,h,mi),canonical=label.replace('T',' ');
 // Two possible Netherlands offsets; verify with IANA data, never host timezone.
 const options=[base-7200000,base-3600000].filter(t=>t>after&&eh31Wall(t)===canonical);
 return options.length?options[0]:null;
}
function eh31CsvRows(text){
 if(typeof text!=='string'||text.length>8*1024*1024)throw Error('CSV is te groot (maximaal 8 MB).');
 const source=text.replace(/^\uFEFF/,'');
 const first=source.split(/\r?\n/,1)[0],sep=first.includes(';')?';':',';
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<source.length;i++){
  const ch=source[i];
  if(quoted){if(ch==='"'){if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
  if(ch==='"'){if(cell||closed)throw Error('Ongeldige aanhalingstekens in CSV.');quoted=true;continue;}
  if(ch===sep||ch==='\n'||ch==='\r'){
   row.push(cell.trim());cell='';closed=false;
   if(ch!==sep){if(ch==='\r'&&source[i+1]==='\n')i++;if(row.some(v=>v!==''))rows.push(row);row=[];}
  }else{if(closed&&ch.trim())throw Error('Ongeldige tekst na een CSV-veld.');cell+=ch;}
 }
 if(quoted)throw Error('CSV bevat een onafgesloten tekstveld.');
 row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);
 if(rows.length>150001)throw Error('Te veel CSV-regels (maximaal 150.000).');
 return rows;
}
function eh31ReadHomeWizard(text){
 const csv=eh31CsvRows(text),header=csv.shift()||[];
 if(new Set(header).size!==header.length)throw Error('CSV bevat dubbele kolomnamen.');
 const columns=['time',...EH31_COUNTERS].map(k=>header.indexOf(k));
 if(columns.some(i=>i<0))throw Error('Gebruik de HomeWizard P1-export met time en Import/Export T1/T2 kWh.');
 if(csv.length<2)throw Error('Minimaal twee meterstanden nodig.');
 const numeric=v=>{if(!/^\d+(?:[.,]\d+)?$/.test(v||''))return null;const n=Number(v.replace(',','.'));return Number.isFinite(n)?n:null;};
 let previous=-Infinity,invalidCounters=0,dstRepeated=0;const labels=new Set();
 const samples=csv.map((r,i)=>{
  if(r.length!==header.length)throw Error('Onjuist aantal velden op regel '+(i+2)+'.');
  const label=r[columns[0]],t=eh31Time(label,previous);
  if(t===null)throw Error('Ongeldige, dubbele of niet-oplopende tijd op regel '+(i+2)+': '+label+'. Exporteer chronologisch in Nederlandse tijd.');
  if(labels.has(label))dstRepeated++;labels.add(label);previous=t;
  const counters=columns.slice(1).map(j=>numeric(r[j]));
  if(counters.some(n=>n===null))invalidCounters++;
  return {t,label,counters};
 });
 const counts=new Map();
 for(let i=1;i<samples.length;i++){const dt=samples[i].t-samples[i-1].t;counts.set(dt,(counts.get(dt)||0)+1);}
 const daily=samples.every(s=>s.label.endsWith('00:00'));
 const step=daily?null:[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0];
 if(!daily&&step!==900000&&step!==3600000)throw Error('Ondersteund: dagelijkse, uur- of kwartierstanden. Deze tijdstap wordt niet herkend.');
 const intervals=[];let resets=0,gaps=0,valid=0,imported=0,exported=0;
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i],duration=b.t-a.t;
  const adjacent=daily?(Date.parse(b.label.slice(0,10))-Date.parse(a.label.slice(0,10))===86400000):duration===step;
  const known=a.counters.every(Number.isFinite)&&b.counters.every(Number.isFinite);
  const delta=known?b.counters.map((v,j)=>v-a.counters[j]):null;
  const reset=delta?.some(v=>v<-.0000001)||false;
  if(reset)resets++;if(!adjacent)gaps++;
  const usable=adjacent&&known&&!reset;
  const imp=usable?Math.max(0,delta[0])+Math.max(0,delta[1]):null;
  const exp=usable?Math.max(0,delta[2])+Math.max(0,delta[3]):null;
  if(usable){valid++;imported+=imp;exported+=exp;}
  intervals.push({t:a.t,end:b.t,localDate:a.label.slice(0,10),import:imp,export:exp});
 }
 return {intervals,resolution:daily?'day':step===900000?'quarter':'hour',step,first:samples[0].t,last:samples.at(-1).t,
  firstLabel:samples[0].label,lastLabel:samples.at(-1).label,readings:samples.length,
  valid,invalidCounters,resets,gaps,dstRepeated,imported,exported};
}
function eh31HistorySummary(data){
 if(!data?.intervals?.length)return null;
 const monthMap=new Map(),yearMap=new Map();
 for(const r of data.intervals){
  const key=r.localDate.slice(0,7),year=key.slice(0,4);
  const known=Number.isFinite(r.import)&&Number.isFinite(r.export);
  for(const [map,k] of [[monthMap,key],[yearMap,year]]){
   const x=map.get(k)||{key:k,imported:0,exported:0,validMs:0};
   if(known){x.imported+=r.import;x.exported+=r.export;x.validMs+=r.end-r.t;}
   map.set(k,x);
  }
 }
 const months=[...monthMap.values()].map(x=>{
  const [y,m]=x.key.split('-').map(Number),next=new Date(Date.UTC(y,m,1)).toISOString().slice(0,10);
  const from=eh31Time(x.key+'-01 00:00'),to=eh31Time(next+' 00:00');
  return {...x,coverage:x.validMs/(to-from)};
 });
 const years=[...yearMap.values()].map(x=>{
  const y=+x.key,from=eh31Time(y+'-01-01 00:00'),to=eh31Time((y+1)+'-01-01 00:00');
  return {...x,coverage:x.validMs/(to-from)};
 });
 // Select the latest completely bounded local calendar year (rolling 12 months).
 const endLabel=data.lastLabel.slice(0,10),end=eh31Time(endLabel+' 00:00');
 const y=+endLabel.slice(0,4)-1;
 let startLabel=String(y)+endLabel.slice(4);
 if(startLabel.endsWith('02-29'))startLabel=String(y)+'-02-28';
 const start=eh31Time(startLabel+' 00:00');
 const rows=data.intervals.filter(r=>r.t>=start&&r.end<=end);
 const validMs=rows.reduce((n,r)=>n+(Number.isFinite(r.import)&&Number.isFinite(r.export)?r.end-r.t:0),0);
 return {months,years,yearWindow:{start,end,rows,coverage:validMs/(end-start),bounded:data.first<=start&&data.last>=end,
  imported:rows.reduce((n,r)=>n+(r.import??0),0),exported:rows.reduce((n,r)=>n+(r.export??0),0)}};
}
function eh31ValidateProfile(raw){
 const required=(key,min,max)=>{const value=raw?.[key];if(value===null||value===undefined||String(value).trim()==='')return null;
  const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;};
 const p={name:String(raw?.name||'Eigen batterij').trim().slice(0,80),
  capacity:required('capacity',.1,100),chargeKw:required('chargeKw',.05,30),dischargeKw:required('dischargeKw',.05,30),
  efficiency:required('efficiency',1,100),standby:required('standby',0,1000),investment:required('investment',1,100000),annualCosts:required('annualCosts',0,10000)};
 return {...p,technical:[p.capacity,p.chargeKw,p.dischargeKw,p.efficiency,p.standby].every(Number.isFinite)};
}
function eh31SimulateSolar(rows,profile,buy,sell){
 const p=eh31ValidateProfile(profile);
 if(!p.technical)return null;
 const eta=Math.sqrt(p.efficiency/100);let soc=0,last=null,charge=0,discharged=0,loss=0,gapLoss=0,standbyGrid=0;
 let before=0,after=0,validMs=0,imported=0,exported=0,remainingExport=0,remainingImport=0;
 const priced=Number.isFinite(buy)&&Number.isFinite(sell);
 for(const r of rows){
  if(!Number.isFinite(r.t)||!Number.isFinite(r.end)||!Number.isFinite(r.import)||!Number.isFinite(r.export)||r.import<0||r.export<0||r.end<=r.t||r.end-r.t>3600000){gapLoss+=soc;soc=0;last=null;continue;}
  if(last!==r.t){gapLoss+=soc;soc=0;}last=r.end;
  const hours=(r.end-r.t)/3600000,standby=p.standby/1000*hours;
  // AC standby is an additional site load, supplied by PV/export first, then battery/grid.
  const pvStandby=Math.min(r.export,standby),pv=r.export-pvStandby,load=r.import+standby-pvStandby;
  let input=0,output=0;
  if(pv>0){input=Math.min(pv,p.chargeKw*hours,(p.capacity-soc)/eta);soc+=input*eta;loss+=input*(1-eta);}
  else if(load>0){output=Math.min(load,p.dischargeKw*hours,soc*eta);soc-=output/eta;loss+=output/eta-output;}
  const out=pv-input,imp=load-output;
  charge+=input;discharged+=output;standbyGrid+=standby;validMs+=r.end-r.t;
  imported+=r.import;exported+=r.export;remainingExport+=out;remainingImport+=imp;
  if(priced){before+=r.import*buy-r.export*sell;after+=imp*buy-out*sell;}
 }
 return {capacity:p.capacity,charge,discharged,loss,gapLoss,endingSoc:soc,standbyKwh:standbyGrid,validMs,
  imported,exported,remainingExport,remainingImport,netImportAvoided:imported-remainingImport,
  periodSaving:priced?before-after:null,priced};
}
function eh31DefaultProfiles(){return [5,10,15].map(capacity=>({name:'Scenario '+capacity+' kWh',capacity,chargeKw:3,dischargeKw:3,efficiency:88,standby:null,investment:null,annualCosts:null}));}
function eh31CompareState(card){
 if(card._eh31Settings)return card._eh31Settings;
 let saved=null;try{saved=JSON.parse(window.localStorage?.getItem(EH31_SETTINGS_KEY)||'null');}catch(_){}
 const profiles=Array.isArray(saved?.profiles)&&saved.profiles.length===3?saved.profiles.map(eh31ValidateProfile):eh31DefaultProfiles();
 const rate=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Math.abs(Number(v))<=5?Number(v):null;
 return card._eh31Settings={profiles,buy:rate(saved?.buy),sell:rate(saved?.sell)};
}
function eh31ComparisonResults(card){
 const data=card._eh31History,settings=eh31CompareState(card);
 if(!data||data.resolution==='day')return null;
 const summary=data.summary||eh31HistorySummary(data),w=summary.yearWindow;
 const rows=w.bounded?w.rows:data.intervals;
 const key=JSON.stringify(settings);
 if(card._eh31Cache?.data===data&&card._eh31Cache?.key===key)return card._eh31Cache.value;
 const value={window:w,fullYear:w.bounded&&w.coverage>=.95,rows,results:settings.profiles.map(p=>eh31SimulateSolar(rows,p,settings.buy,settings.sell))};
 card._eh31Cache={data,key,value};return value;
}
function eh31CompareHtml(card){
 const settings=eh31CompareState(card),data=card._eh31History,summary=data?.summary;
 const result=eh31ComparisonResults(card);
 const field=(i,key,label,options={})=>{
  const value=settings.profiles[i][key];return '<label>'+label+'<input data-eh31-profile="'+i+'" data-eh31-field="'+key+'" '+(key==='name'?'type="text" maxlength="80"':'type="number" step="any" inputmode="decimal" min="'+(options.min??0)+'" max="'+(options.max??100000)+'"')+' value="'+ehEsc(value??'')+'" placeholder="Invullen"></label>';
 };
 const date=t=>new Date(t).toLocaleDateString('nl-NL',{timeZone:'Europe/Amsterdam'});
 const controls='<div class="eh31-upload"><label class="eh31-file-label">Importeer HomeWizard P1-export<input type="file" accept=".csv,text/csv" data-eh31-file aria-label="Importeer HomeWizard CSV" '+(card._eh31Loading?'disabled':'')+'></label>'+
 '<p class="eh20-meta">CSV met meterstanden · Nederlandse tijd · maximaal 8 MB. Het bestand blijft in dit tabblad en wordt niet verstuurd of blijvend opgeslagen. Na herladen opnieuw importeren.</p>'+
 (card._eh31Loading?'<p role="status">Meterstanden controleren…</p>':'')+
 (card._eh31Error?'<p class="eh20-notice" role="alert">'+ehEsc(card._eh31Error)+'</p>':'')+
 (data?'<p class="eh20-meta">'+ehEsc(data.fileName)+' · '+data.readings+' meterstanden · '+ehEsc(data.firstLabel)+' tot '+ehEsc(data.lastLabel)+' · '+({day:'dag',quarter:'kwartier',hour:'uur'}[data.resolution])+'gegevens.</p><button type="button" data-eh31-clear>Verwijder geïmporteerde historie</button>':'')+'</div>';
 let history='';
 if(summary){
 const w=summary.yearWindow;
 const years=summary.years.map(y=>'<tr><th scope="row">'+y.key+'</th><td>'+ehFmt(y.imported,1)+'</td><td>'+ehFmt(y.exported,1)+'</td><td>'+ehFmt(y.coverage*100,1)+'%</td></tr>').join('');
 const chosen=summary.years.some(y=>y.key===card._eh31ChartYear)?card._eh31ChartYear:summary.years.at(-1).key;
 const monthData=summary.months.filter(m=>m.key.startsWith(chosen));
 const max=Math.max(1,...monthData.map(m=>Math.max(m.imported,m.exported)));
 const chart=Array.from({length:12},(_,i)=>{
  const m=monthData.find(m=>+m.key.slice(5)===i+1),x=32+i*45;
  return '<text x="'+(x+12)+'" y="180" fill="#b9d6e1" text-anchor="middle" font-size="11">'+(i+1)+'</text>'+
   (!m?'<text x="'+(x+12)+'" y="160" fill="#aac1cc" text-anchor="middle">–</text>':
    '<g><title>'+m.key+': afname '+ehFmt(m.imported,1)+' kWh, teruglevering '+ehFmt(m.exported,1)+' kWh; '+ehFmt(m.coverage*100,1)+'% dekking</title><rect x="'+x+'" y="'+(162-m.imported/max*135).toFixed(2)+'" width="11" height="'+(m.imported/max*135).toFixed(2)+'" fill="#79baff"/><rect x="'+(x+13)+'" y="'+(162-m.exported/max*135).toFixed(2)+'" width="11" height="'+(m.exported/max*135).toFixed(2)+'" fill="#48dca7"/></g>');
 }).join('');
 const months=monthData.map(m=>'<tr><th scope="row">'+m.key+'</th><td>'+ehFmt(m.imported,1)+'</td><td>'+ehFmt(m.exported,1)+'</td><td>'+ehFmt(m.coverage*100,1)+'%</td></tr>').join('');
 history='<section class="eh31-card"><h4>Jouw stroomprofiel</h4><p class="eh20-meta">'+(w.bounded?'Laatste begrensde jaar: '+date(w.start)+' tot '+date(w.end)+' (einddatum exclusief) · '+ehFmt(w.coverage*100,1)+'% energiedekking.':'Nog geen volledig begrensd jaar in deze export.')+'</p>'+
 (w.bounded?'<div class="eh20-kpis"><div><small>Netafname · jaarvenster</small><strong>'+ehFmt(w.imported,1)+' kWh</strong></div><div><small>Teruglevering · jaarvenster</small><strong>'+ehFmt(w.exported,1)+' kWh</strong></div></div>':'')+
 '<label>Grafiekjaar <select data-eh31-year>'+summary.years.map(y=>'<option value="'+y.key+'" '+(y.key===chosen?'selected':'')+'>'+y.key+'</option>').join('')+'</select></label>'+
 '<p class="eh20-meta">Blauw: netafname · groen: teruglevering · kWh per maand. Ontbrekende maanden zijn leeg; onvolledige maanden staan in de tabel.</p>'+
 '<svg class="eh31-season" viewBox="0 0 590 192" role="img" aria-label="Maandprofiel '+chosen+'; exacte kWh en meetdekking in onderstaande tabel"><text x="3" y="16" fill="#b9d6e1" font-size="12">'+ehFmt(max,0)+' kWh</text>'+chart+'</svg>'+
 '<details class="eh31-months"><summary>Exacte maand- en jaartotalen</summary><div class="eh20-table-wrap"><table class="eh20-table"><caption>Maanden '+chosen+' · alleen gemeten intervallen</caption><thead><tr><th>Maand</th><th>Afname kWh</th><th>Terug kWh</th><th>Dekking</th></tr></thead><tbody>'+months+'</tbody></table><table class="eh20-table"><caption>Kalenderjaren · gedeeltelijke jaren niet extrapoleren</caption><thead><tr><th>Jaar</th><th>Afname kWh</th><th>Terug kWh</th><th>Dekking</th></tr></thead><tbody>'+years+'</tbody></table></div></details>'+
 '<p class="eh20-meta">Datacontrole: '+data.gaps+' niet-aansluitende intervallen · '+data.resets+' tellerteruglopen · '+data.invalidCounters+' ongeldige meterstanden · '+data.dstRepeated+' herhaalde kloklabels bij wintertijd. Geen gaten met nul aangevuld.</p></section>';
 }
 const profiles='<details class="eh31-profiles"><summary>Batterijen en offertegegevens instellen</summary><p class="eh20-meta">Drie generieke scenario’s; vul jouw productgegevens in. 3 kW en 88% zijn zichtbare rekenaannames. Standbyverbruik, offerte en jaarlijkse kosten zijn onbekend totdat je ze invult; nul moet je bewust invullen. Alleen deze instellingen blijven lokaal bewaard.</p><div class="eh31-profiles-grid">'+settings.profiles.map((_,i)=>'<fieldset><legend>Batterij '+(i+1)+'</legend>'+field(i,'name','Naam / model')+field(i,'capacity','Bruikbare capaciteit (kWh)',{min:.1,max:100})+field(i,'chargeKw','AC laadvermogen (kW)',{min:.05,max:30})+field(i,'dischargeKw','AC ontlaadvermogen (kW)',{min:.05,max:30})+field(i,'efficiency','Rondrendement (%)',{min:1,max:100})+field(i,'standby','Continu AC standbyverbruik (W)',{max:1000})+field(i,'investment','Offerte inclusief installatie (€)',{min:1,max:100000})+field(i,'annualCosts','Abonnement + onderhoud (€/jaar)',{max:10000})+'</fieldset>').join('')+'</div></details>';
 const rates='<details class="eh31-rates"><summary>Tariefscenario instellen</summary><p class="eh20-meta">Vaste, door jou gekozen all-in energietarieven voor een rekenscenario. Geen historische dynamische tarieven, saldering of terugleverkosten verwerkt. Daarom geen verwachte terugverdientijd of productwinnaar.</p><div class="eh22-inputs">'+[['buy','Vermeden inkoop (€/kWh)'],['sell','Gemiste teruglevering (€/kWh)']].map(([key,label])=>'<label>'+label+'<input data-eh31-rate="'+key+'" type="number" min="-5" max="5" step="any" inputmode="decimal" placeholder="Onbekend" value="'+ehEsc(settings[key]??'')+'"></label>').join('')+'</div></details>';
 let comparisons='<p class="eh20-notice">Importeer een uur- of kwartierexport om de drie batterijen op dezelfde verbruiksreeks door te rekenen.</p>';
 if(data?.resolution==='day')comparisons='<p class="eh20-notice">Deze export bevat dagstanden. Het stroomprofiel is bruikbaar, maar laadvolgorde binnen de dag ontbreekt. Er worden geen batterijbesparingen of terugverdientijden uit verzonnen.</p>';
 if(result){
 const w=result.window;
 const title=result.fullYear?'Technisch jaarscenario':'Technisch periodescenario';
 comparisons='<section class="eh31-card"><h4>'+title+'</h4><p class="eh20-meta">Alleen zonneladen; start-SOC 0 kWh. '+(w.bounded?'Rekenperiode '+date(w.start)+' tot '+date(w.end)+' (exclusief).':'Alle beschikbare intervallen; geen jaarextrapolatie.')+' De Cupra blijft onderdeel van de gemeten afname. Geen verschoven EV-lading of netladen.</p><div class="eh31-results">'+result.results.map((s,i)=>{
  const p=eh31ValidateProfile(settings.profiles[i]);
  if(!s)return '<article><h5>'+ehEsc(p.name)+'</h5><p>Vul eerst geldige technische gegevens en standbyverbruik in.</p></article>';
  const net=s.periodSaving,after=net!==null&&result.fullYear&&p.annualCosts!==null?net-p.annualCosts:null;
  return '<article><h5>'+ehEsc(p.name)+'</h5><dl><dt>Bruikbare opslag</dt><dd>'+ehFmt(p.capacity,1)+' kWh</dd><dt>Netafname vermeden (netto)</dt><dd>'+ehFmt(s.netImportAvoided,1)+' kWh</dd><dt>PV naar opslag</dt><dd>'+ehFmt(s.charge,1)+' kWh</dd><dt>Conversieverlies</dt><dd>'+ehFmt(s.loss,1)+' kWh</dd><dt>Standby-energie</dt><dd>'+ehFmt(s.standbyKwh,1)+' kWh</dd><dt>Resterende SOC</dt><dd>'+ehFmt(s.endingSoc,2)+' kWh</dd><dt>Operationeel tariefscenario</dt><dd>'+(net===null?'Tariefinvoer ontbreekt':ehEuro2(net))+'</dd><dt>Na jaarlijkse vaste kosten</dt><dd>'+(after===null?'Nog niet berekenbaar':ehEuro2(after))+'</dd><dt>Offerte + installatie</dt><dd>'+(p.investment===null?'Onbekend':ehEuro2(p.investment))+'</dd><dt>Verwachte terugverdientijd</dt><dd>Nog niet verantwoord</dd></dl></article>';
 }).join('')+'</div><p class="eh20-notice">Geen aankoopadvies: contractregels, batterijdegradatie, garantie, fysieke piekbelasting en alternatief slim Cupra-laden zijn nog niet doorgerekend. Resterende energie wordt niet als opbrengst gewaardeerd; bij gaten wordt SOC afgeboekt. Gelijktijdige afname en teruglevering binnen één interval hebben onbekende volgorde: de simulatie kiest dan alleen laden.</p></section>';
 }
 return '<section class="eh31-compare" aria-label="Persoonlijke batterijvergelijker"><h3>Batterijen vergelijken op jouw verbruik</h3>'+controls+history+profiles+rates+comparisons+'<p class="eh20-meta" role="status">'+ehEsc(card._eh31SaveNote||'')+'</p></section>';
}
function eh31Css(){return '.eh26-tabs{grid-template-columns:repeat(4,minmax(0,1fr))}.eh31-compare{min-width:0}.eh31-upload,.eh31-card,.eh31-profiles,.eh31-rates{background:#0a293c;border:1px solid #6799aa70;border-radius:13px;padding:12px;margin:12px 0;min-width:0}.eh31-compare h3{font-size:17px}.eh31-compare h4{font-size:15px;margin:4px 0 10px}.eh31-compare p{line-height:1.5}.eh31-file-label,.eh31-compare label{display:flex;flex-direction:column;gap:7px;font-size:12px;color:#c9e5ee}.eh31-compare input,.eh31-compare select{box-sizing:border-box;min-width:0;width:100%;min-height:42px;border:1px solid #719caf;border-radius:8px;padding:9px;background:#092536;color:#e9fafb;font:inherit;font-size:16px}.eh31-compare input[type=file]{font-size:12px}.eh31-compare button{background:#134c40;color:#edfff8;border:1px solid #57cba4;border-radius:8px;min-height:42px;padding:9px;cursor:pointer}.eh31-compare summary{font-size:13px;min-height:36px;cursor:pointer;color:#c8e6ed}.eh31-season{display:block;width:100%;height:auto;max-height:240px}.eh31-profiles-grid,.eh31-results{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.eh31-profiles fieldset,.eh31-results article{min-width:0;border:1px solid #6894a75c;border-radius:10px;padding:11px;background:#0b3042}.eh31-profiles label{margin:10px 0}.eh31-results h5{font-size:15px;margin:0 0 12px;overflow-wrap:anywhere}.eh31-results dl{margin:0}.eh31-results dt{font-size:11px;color:#a8c9d6;margin-top:10px}.eh31-results dd{font-size:14px;color:#e9fff8;margin:4px 0;overflow-wrap:anywhere}@media(max-width:600px){.eh26-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.eh31-profiles-grid,.eh31-results{grid-template-columns:1fr}.eh31-upload,.eh31-card{padding:10px}}';}
function eh31UpdateSetting(card,el){
 if(!el?.matches?.('[data-eh31-profile],[data-eh31-rate]'))return false;
   const settings=eh31CompareState(card),raw=String(el.value).trim();
   const key=el.dataset.eh31Field;
   if(el.hasAttribute('data-eh31-profile')){
    const index=Number(el.dataset.eh31Profile);
    if(!Number.isInteger(index)||index<0||index>2||!['name','capacity','chargeKw','dischargeKw','efficiency','standby','investment','annualCosts'].includes(key))return false;
    const draft={...settings.profiles[index],[key]:key==='name'?raw:raw===''?null:Number(raw)};
    settings.profiles[index]=eh31ValidateProfile(draft);
   }else{
    const rateKey=el.dataset.eh31Rate;if(!['buy','sell'].includes(rateKey))return false;
    const n=raw===''?null:Number(raw);settings[rateKey]=n!==null&&Number.isFinite(n)&&Math.abs(n)<=5?n:null;
   }
 card._eh31Cache=null;return true;
}
(function eh31ImportEvents(){
 const P=EnergiehuisCard.prototype,render=P._render;
 P._render=function(){
  // Preserve focused edits during incoming HA updates; update results on blur.
  if(this._view==='battery'&&this._eh26Tab==='compare'&&this.shadowRoot?.activeElement?.matches?.('[data-eh31-profile],[data-eh31-rate]'))return;
  render.call(this);
  const root=this.shadowRoot,style=root?.querySelector?.('style');
  if(style&&!style.textContent.includes('.eh31-compare{'))style.textContent+='\n'+eh31Css();
  if(!root||this._eh31Events)return;this._eh31Events=true;
  root.addEventListener('input',e=>{eh31UpdateSetting(this,e.target);});
  root.addEventListener('focusout',e=>{if(e.target?.matches?.('[data-eh31-profile],[data-eh31-rate]'))this._schedule();});
  root.addEventListener('change',async e=>{
   const el=e.target;
   if(el?.matches?.('[data-eh31-file]')){
    const file=el.files?.[0];if(!file)return;
    const request=this._eh31ImportRequest=(this._eh31ImportRequest||0)+1;
    this._eh31Loading=true;this._eh31Error='';this._schedule();
    try{
     if(file.size>8*1024*1024)throw Error('CSV is te groot (maximaal 8 MB).');
     const text=await file.text();
     // Let the loading state paint before processing a multi-year export.
     await new Promise(resolve=>setTimeout(resolve,0));
     const parsed=eh31ReadHomeWizard(text);parsed.fileName=file.name;parsed.summary=eh31HistorySummary(parsed);
     if(request!==this._eh31ImportRequest)return;
     this._eh31History=parsed;this._eh31ChartYear=null;this._eh31Cache=null;
    }catch(err){if(request===this._eh31ImportRequest)this._eh31Error=String(err?.message||'Importeren mislukt.');}
    finally{if(request===this._eh31ImportRequest){this._eh31Loading=false;this._schedule();}}
    return;
   }
   if(el?.matches?.('[data-eh31-year]')){this._eh31ChartYear=el.value;this._schedule();return;}
   if(!eh31UpdateSetting(this,el))return;
   const settings=eh31CompareState(this);
   try{window.localStorage.setItem(EH31_SETTINGS_KEY,JSON.stringify({profiles:settings.profiles.map(eh31ValidateProfile),buy:settings.buy,sell:settings.sell}));this._eh31SaveNote='Batterij- en tariefinstellingen lokaal bewaard.';}
   catch(_){this._eh31SaveNote='Opslaan niet gelukt; instellingen blijven alleen in dit tabblad.';}
   this._eh31Cache=null;this._schedule();
  });
  root.addEventListener('click',e=>{if(e.target?.closest?.('[data-eh31-clear]')){
   this._eh31ImportRequest=(this._eh31ImportRequest||0)+1;this._eh31History=null;this._eh31Cache=null;this._eh31Loading=false;this._eh31Error='';this._schedule();
  }});
 };
})();
