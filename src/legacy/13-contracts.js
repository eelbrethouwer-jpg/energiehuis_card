/* Stroomvergelijker — isolated scenario engine; never writes HA states or existing cost history. */
const ehCompareDateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const EH_COMPARE_STORAGE='energiehuis.electricity-contracts.v1';
// Public tariff catalogue. Requests only on explicit opening/refresh; never submits an offer request.
const EH_TARIFF_DATA='https://raw.githubusercontent.com/zhinees/energieprijzen-nl/main/data/';
const EH_TARIFF_ATTRIBUTION='https://github.com/zhinees/energieprijzen-nl';
function ehTariffUrl(value){try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch(_){return '';}}
function ehTariffValue(field,unit){return field?.eenheid===unit&&Number.isFinite(field.bedragInclBtw)?field.bedragInclBtw:null;}
function ehTariffDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)&&Number.isFinite(Date.parse(value))?value.slice(0,10):'';}
function ehTariffStatus(fields,now=new Date()){
 const dates=fields.map(f=>ehTariffDate(f?.laatstGecontroleerd||f?.gecontroleerdOp));
 const checked=dates.every(Boolean)?dates.sort()[0]:'';
 const days=checked?(+now-Date.parse(checked))/86400000:null;
 return {checked,stale:days===null||days>30||days< -1};
}
function ehTariffCatalogue(dynamic,fixed){
 if(dynamic?.versie!==1||dynamic?.valuta!=='EUR'||!Array.isArray(dynamic.leveranciers)||fixed?.valuta!=='EUR'||fixed?.inclBtw!==true||!Array.isArray(fixed.contracten))throw new Error('Onbekend formaat van de tarievenbron.');
 if(dynamic.leveranciers.length>100||fixed.contracten.length>100)throw new Error('Tarievenlijst is onverwacht groot.');
 const entries=[];
 const add=(raw,type)=>{
  if(type==='dynamic'&&raw.producten?.stroom!==true)return;
  const t=raw.tarieven||{},keys=type==='dynamic'?['stroomVastPerMaand','stroomInkoopopslag','terugleverCorrectie']:['stroomVastPerMaand','stroomLeveringPerKwh','terugleververgoedingPerKwh','terugleverkostenPerKwh'];
  const fields=keys.map(key=>({key,...t[key]}));
  const title=String(type==='dynamic'?raw.naam:raw.leverancier+' · '+raw.naam).slice(0,160);
  const id=type+'-'+String(raw.id||'');if(!/^[a-z0-9-]{1,100}$/.test(id))throw new Error('Ongeldig aanbieder-ID.');
  const source={catalogueId:id,title,url:ehTariffUrl(raw.tariefUrl),checked:ehTariffStatus(fields).checked,
   note:String(raw.notitie||'').slice(0,3000),fields:fields.map(f=>({key:f.key,value:ehTariffValue(f,f.key==='stroomVastPerMaand'?'EUR/maand':'EUR/kWh'),unit:String(f.eenheid||''),checked:ehTariffDate(f.laatstGecontroleerd||f.gecontroleerdOp),url:ehTariffUrl(f.bronUrl),note:String(f.notitie||'').slice(0,2000),verified:f.geverifieerd===true}))};
  const value=key=>source.fields.find(f=>f.key===key)?.value??null;
  entries.push({id,title,type,source,onlyModel:raw.alleenModelcontract===true,draft:{name:title,type,settlement:'separate',priceBasis:type==='dynamic'?'market':'components',buy:null,delivery: type==='fixed'?value('stroomLeveringPerKwh'):null,tax:null,markup:type==='dynamic'?value('stroomInkoopopslag'):null,exportAdjustment:type==='dynamic'?value('terugleverCorrectie'):null,exportMode:type==='dynamic'?'market':'fixed',sell:type==='fixed'?value('terugleververgoedingPerKwh'):null,exportFee:type==='fixed'?value('terugleverkostenPerKwh'):0,fixedPeriod:'monthly',monthly:value('stroomVastPerMaand'),daily:null,priceEntity:'',source,sourceConfirmed:false,from:'',to:''}});
 };
 dynamic.leveranciers.forEach(x=>add(x,'dynamic'));fixed.contracten.forEach(x=>add(x,'fixed'));
 if(new Set(entries.map(e=>e.id)).size!==entries.length)throw new Error('Dubbele aanbieders in de bron.');
 return entries;
}
function ehTariffYearTax(taxes,year){
 if(taxes?.versie!==1||taxes?.valuta!=='EUR'||!/^20\d{2}$/.test(String(year)))return null;
 const row=taxes.jaren?.[year],value=row?.stroomPerKwh?.bedragInclBtw;
 return row?.geverifieerd===true&&Number.isFinite(value)&&value>=0&&value<2?value:null;
}
function ehTariffQuickContract(entry,taxes,year,existing=[]){
 if(!entry||!['fixed','dynamic'].includes(entry.type)||!/^[a-z0-9-]+$/.test(entry.id))throw new Error('Selecteer een geldig contract.');
 const chosen={...entry.draft,id:'catalog-'+entry.id,source:ehTariffSource(entry.source),sourceConfirmed:true,
  from:year+'-01-01',to:year+'-12-31',reference:false,tax:ehTariffYearTax(taxes,year)};
 if(entry.type==='dynamic'){
  const sensor=existing.find(c=>!c.pending&&c.type==='dynamic'&&c.priceBasis==='market'&&/^sensor\.[a-z0-9_]+$/.test(c.priceEntity))?.priceEntity;
  chosen.priceEntity=sensor||'';
 }
 try{return ehCompareContract(chosen);}
 catch(e){return ehCompareContract({...chosen,pending:true,pendingReason:e.message||'Vereiste tarieven of prijssensor ontbreken.'});}
}
function ehTariffSource(raw){
 if(!raw)return null;
 if(typeof raw!=='object'||!Array.isArray(raw.fields)||raw.fields.length>8)throw new Error('Ongeldige brongegevens.');
 return {catalogueId:String(raw.catalogueId||'').slice(0,100),title:String(raw.title||'').slice(0,160),url:ehTariffUrl(raw.url),checked:ehTariffDate(raw.checked),note:String(raw.note||'').slice(0,3000),fields:raw.fields.map(f=>({key:String(f.key||'').slice(0,80),value:ehCompareNumber(f.value),unit:String(f.unit||'').slice(0,30),checked:ehTariffDate(f.checked),url:ehTariffUrl(f.url),note:String(f.note||'').slice(0,2000),verified:f.verified===true}))};
}
function ehTariffSourceHtml(source,full=false){
 if(!source)return '';
 const stale=!source.checked||(Date.now()-Date.parse(source.checked))>30*86400000||Date.parse(source.checked)>Date.now()+86400000;
 const link=(url,label)=>url?`<a href="${ehEsc(url)}" target="_blank" rel="noopener noreferrer">${ehEsc(label)}</a>`:ehEsc(label);
 return `<div class="ehcat-source"><small>Bron: ${link(EH_TARIFF_ATTRIBUTION,'energieprijzen-nl')} · CC BY 4.0 · controle ${source.checked?ehEsc(source.checked):'datum ontbreekt'}${stale?' · controle nodig':''}. Gegevens van derden; niet onafhankelijk door Energiehuis geverifieerd.</small>${full?`<p>${link(source.url,'Leveranciersbron openen')}</p>${source.note?'<p>'+ehEsc(source.note)+'</p>':''}<ul>${source.fields.map(f=>`<li><strong>${ehEsc(f.key)}</strong>: ${f.value===null?'ontbreekt':ehEsc(f.value)} ${ehEsc(f.unit)} · ${f.checked?ehEsc(f.checked):'controledatum ontbreekt'} ${link(f.url,'bron')}${f.note?'<br>'+ehEsc(f.note):''}</li>`).join('')}</ul>`:''}</div>`;
}
function ehTariffCatalogueHtml(card){
 if(!card._ehcatOpen)return '';
 const entries=(card._ehcatEntries||[]).filter(e=>!card._ehcatFilter||e.type===card._ehcatFilter);
 const chosen=entries.find(e=>e.id===card._ehcatSelected),year=new Date().getFullYear(),tax=ehTariffYearTax(card._ehcatTaxes,year);
 const quick=chosen?ehTariffQuickContract(chosen,card._ehcatTaxes,year,card._ehcmpContracts||[]):null;
 const options=entries.map(e=>'<option value="'+ehEsc(e.id)+'" '+(chosen?.id===e.id?'selected':'')+'>'+ehEsc(e.title)+(e.onlyModel?' (modelcontract)':'')+'</option>').join('');
 const summary=chosen?'<section class="ehcat-quick"><strong>'+ehEsc(chosen.title)+'</strong><small>'+(chosen.type==='fixed'?'Vast':'Dynamisch')+(chosen.onlyModel?' · modelcontract':'')+' · '+year+'</small>'+
  ehTariffSourceHtml(chosen.source)+'<p class="subtle">Energiebelasting '+(tax===null?'niet beschikbaar':ehEuro2(tax)+'/kWh uit jaarbron')+'. Dit is een indicatief scenario met de nu bekende tarieven op historische P1-uren; geen overstapofferte of exacte jaarafrekening. Saldering, staffels en bonussen kunnen afwijken.</p>'+
  (quick.pending?'<p class="plan-warning" role="status">Na opslaan nog niet berekenbaar: '+ehEsc(quick.pendingReason)+' Je kunt het later aanvullen via Bewerken.</p>':'<p class="subtle">De bekende bedragen zijn ingevuld. Controleer het aanbod van de leverancier bij een echte overstap.</p>')+'</section>':'<p class="subtle">Kies een contract uit de lijst. Daarna hoef je alleen op Opslaan te drukken.</p>';
 return `<section class="ehcat"><div class="subpage-head"><div><div class="eyebrow">Alleen stroom</div><h3>Aanbieders & tarieven</h3></div></div>
 <p class="subtle">Tarieven uit een onafhankelijke openbare bron. Geen volledige overstapmarkt, maar indicatieve scenario's.</p>
 <div class="ehcmp-actions"><button type="button" data-ehcat-action="refresh" ${card._ehcatLoading?'disabled':''}>Tarieven vernieuwen</button></div>
 ${card._ehcatLoading?'<p role="status">Tarieven ophalen…</p>':''}
 ${card._ehcatError?`<p role="alert">${ehEsc(card._ehcatError)}${entries.length?' De eerder opgehaalde lijst blijft hieronder staan.':''}</p>`:''}
 <div class="ehcat-picker"><label>Soort contract<select data-ehcat-filter><option value="">Alle</option><option value="dynamic" ${card._ehcatFilter==='dynamic'?'selected':''}>Dynamisch</option><option value="fixed" ${card._ehcatFilter==='fixed'?'selected':''}>Vast</option></select></label>
 <label>Aanbieder en contract<select data-ehcat-select><option value="">Kies een contract…</option>${options}</select></label></div>
 ${summary}
 <div class="ehcmp-actions"><button type="button" data-ehcat-action="save-selected" ${chosen?'':'disabled'}>Contract opslaan</button></div>
 <details class="ehcmp-info" data-ehcat-advanced><summary>Geavanceerd: brongegevens en tarieven zelf aanpassen</summary>
 <div class="ehcat-list">${entries.map(e=>`<article><strong>${ehEsc(e.title)}</strong><small>${e.type==='dynamic'?'Dynamisch':'Vast'}${e.onlyModel?' · uitsluitend modelcontract':''}</small>${ehTariffSourceHtml(e.source)}<button type="button" data-ehcat-add="${ehEsc(e.id)}">Controleren & toevoegen</button></article>`).join('')}</div></details>
 <small>Bron: <a href="${EH_TARIFF_ATTRIBUTION}" target="_blank" rel="noopener noreferrer">energieprijzen-nl</a> · CC BY 4.0. Contracten blijven alleen op dit apparaat bewaard. Bronvelden en controledatums blijven inzichtelijk.</small></section>`;
}
function ehTariffFixedCost(c,limits){
 if(c.fixedPeriod!=='monthly')return limits.days*c.daily;
 let total=0;for(let day=new Date(limits.from);day<limits.to;day.setDate(day.getDate()+1))total+=c.monthly/new Date(day.getFullYear(),day.getMonth()+1,0).getDate();return total;
}
function ehCompareNumber(v){return typeof v==='number'&&Number.isFinite(v)?v:null;}
function ehCompareContract(raw){
 if(!raw||typeof raw!=='object')throw new Error('Ongeldig contract.');
 const c={id:String(raw.id||'').slice(0,80),name:String(raw.name||'').trim().slice(0,80),type:raw.type,
  priceEntity:String(raw.priceEntity||'').trim(),settlement:raw.settlement,from:String(raw.from||''),to:String(raw.to||''),
  buy:ehCompareNumber(raw.buy),sell:ehCompareNumber(raw.sell),daily:ehCompareNumber(raw.daily),exportFee:ehCompareNumber(raw.exportFee),reference:raw.reference===true,
  priceBasis:raw.priceBasis||'retail',delivery:ehCompareNumber(raw.delivery),tax:ehCompareNumber(raw.tax),markup:ehCompareNumber(raw.markup),exportMode:raw.exportMode||'fixed',exportAdjustment:ehCompareNumber(raw.exportAdjustment),fixedPeriod:raw.fixedPeriod||'daily',monthly:ehCompareNumber(raw.monthly),source:ehTariffSource(raw.source),sourceConfirmed:raw.sourceConfirmed===true};
 if(!c.id||!c.name||!['fixed','dynamic'].includes(c.type)||!['separate','net'].includes(c.settlement))throw new Error('Vul naam, contracttype en verrekenmethode in.');
 if(raw.pending===true){
  if(!/^catalog-(fixed|dynamic)-[a-z0-9-]+$/.test(c.id)||!c.source?.catalogueId||!c.sourceConfirmed||!c.name||!['fixed','dynamic'].includes(c.type))throw new Error('Ongeldige voorlopige catalogusselectie.');
  c.pending=true;c.pendingReason=String(raw.pendingReason||'Benodigde tariefgegevens ontbreken.').slice(0,220);
  return c;
 }
 if(c.type==='dynamic'&&(!/^sensor\.[a-z0-9_]+$/.test(c.priceEntity)||c.settlement!=='separate'))throw new Error('Dynamisch vereist een prijssensor en afzonderlijke afname/teruglevering.');
 if(!['retail','components','market'].includes(c.priceBasis)||!['fixed','market'].includes(c.exportMode)||!['daily','monthly'].includes(c.fixedPeriod))throw new Error('Onbekende prijsgrondslag.');
 if(c.source&&!c.sourceConfirmed)throw new Error('Controleer en bevestig eerst de brongegevens.');

 if(c.priceBasis==='components'){if(c.type!=='fixed'||c.delivery===null||c.delivery<0||c.tax===null||c.tax<0||c.tax>2)throw new Error('Vul levering en energiebelasting inclusief btw in.');c.buy=c.delivery+c.tax;}
 if(c.priceBasis==='market'&&(c.type!=='dynamic'||c.tax===null||c.tax<0||c.tax>2||c.markup===null||Math.abs(c.markup)>2))throw new Error('Vul energiebelasting en leveranciersopslag inclusief btw in.');
 if(c.exportMode==='market'&&(c.priceBasis!=='market'||c.exportAdjustment===null||Math.abs(c.exportAdjustment)>2))throw new Error('Markt-teruglevering vereist dezelfde kale beursprijssensor en een correctie.');
 if(c.fixedPeriod==='monthly'&&(c.monthly===null||c.monthly<0||c.monthly>3000))throw new Error('Vul vaste leverancierskosten per maand in.');
 if(c.type==='fixed'&&(c.buy===null||c.buy<0||c.buy>10))throw new Error('Vul een vast afnametarief in tussen 0 en 10 €/kWh.');
 if((c.exportMode==='fixed'&&(c.sell===null||Math.abs(c.sell)>10))||(c.fixedPeriod==='daily'&&(c.daily===null||c.daily<0||c.daily>100))||c.exportFee===null||c.exportFee<0||c.exportFee>10)throw new Error('Vul alle kosten in; gebruik expliciet 0 als kosten niet gelden.');
 for(const d of [c.from,c.to])if(d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d))throw new Error('Ongeldige geldigheidsdatum.');
 if(c.from&&c.to&&c.from>c.to)throw new Error('Einddatum ligt vóór begindatum.');
 return c;
}
function ehCompareList(raw){
 if(!Array.isArray(raw)||raw.length>30)throw new Error('Maximaal 30 contracten toegestaan.');
 const list=raw.map(ehCompareContract);
 if(new Set(list.map(c=>c.id)).size!==list.length)throw new Error('Contract-ID komt dubbel voor.');
 if(list.filter(c=>c.reference).length>1)throw new Error('Kies één Zonneplan-referentie.');
 return list;
}
function ehCompareDates(period,start,end,now=new Date()){
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 let from=period==='year'?new Date(today.getFullYear(),0,1):new Date(today.getFullYear(),today.getMonth(),1),to=today;
 if(period==='custom'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start||'')||!/^\d{4}-\d{2}-\d{2}$/.test(end||''))throw new Error('Kies een begin- en einddatum.');
  from=new Date(start+'T00:00:00');to=new Date(end+'T00:00:00');
  if(ehCompareDateKey(from)!==start||ehCompareDateKey(to)!==end)throw new Error('Ongeldige periode.');
  to.setDate(to.getDate()+1);
 }
 if(period!=='custom'&&!(from<to))throw new Error('Er is nog geen volledig afgeronde dag in deze periode. De contracttarieven hieronder zijn wel al te bekijken.');
 if(!(from<to)||to>today||(to-from)>367*86400000)throw new Error('Kies 1 tot 366 afgeronde dagen, uiterlijk gisteren.');
 let days=0;for(let d=new Date(from);d<to;d.setDate(d.getDate()+1))days++;
 return {from,to,days};
}
function ehCompareRows(stats,config,h,limits){
 const map=id=>{
  const factor=eh20EnergyUnit(h,id),out=new Map();
  if(factor===null)return out;
  let prior=null;
  for(const s of (stats?.[id]||[]).slice().sort((a,b)=>eh20PriceTime(a.start)-eh20PriceTime(b.start))){
   const t=eh20PriceTime(s.start),sum=ehNum(s.sum),change=ehNum(s.change);
   // A difference is valid only between adjacent hours. Never distribute a gap over a later hour.
   const value=change!==null?change:prior&&t-prior.t===3600000&&sum!==null&&prior.sum!==null?sum-prior.sum:null;
   if(Number.isFinite(t)&&value!==null&&value>=0)out.set(t,value*factor);
   prior={t,sum};
  }
  return out;
 };
 const im=map(config.import),ex=map(config.export),rows=[];
 for(let t=+limits.from;t<+limits.to;t+=3600000)rows.push({t,import:im.get(t)??null,export:ex.get(t)??null});
 return rows;
}
function ehCompareCalculate(contracts,rows,prices,limits){
 const expected=(limits.to-limits.from)/3600000;
 const valid=rows.filter(r=>Number.isFinite(r.import)&&r.import>=0&&Number.isFinite(r.export)&&r.export>=0);
 const complete=rows.length===expected&&valid.length===expected&&new Set(rows.map(r=>r.t)).size===expected&&rows.every((r,i)=>r.t===+limits.from+i*3600000);
 const imported=valid.reduce((s,r)=>s+r.import,0),exported=valid.reduce((s,r)=>s+r.export,0);
 const last=new Date(+limits.to-1),firstKey=ehCompareDateKey(limits.from),lastKey=ehCompareDateKey(last);
 const results=contracts.map(c=>{
  let reason=c.pending?(c.pendingReason||'Tariefgegevens nog onvolledig'):!complete?'Onvolledige P1-uurhistorie':c.from&&c.from>firstKey||c.to&&c.to<lastKey?'Contract niet geldig over de hele periode':null;
  if(!reason&&['components','market'].includes(c.priceBasis)&&limits.from.getFullYear()!==last.getFullYear())reason='Splits de periode per kalenderjaar voor de energiebelasting';
  const p=prices[c.priceEntity]||new Map();
  if(!reason&&c.type==='dynamic'&&rows.some(r=>!Number.isFinite(p.get(r.t))))reason='Prijshistorie ontbreekt voor één of meer uren';
  if(reason)return {contract:c,reason,total:null};
  const net=c.settlement==='net';
  const purchase=c.type==='dynamic'?rows.reduce((s,r)=>s+r.import*(p.get(r.t)+(c.priceBasis==='market'?c.tax+c.markup:0)),0):(net?Math.max(0,imported-exported):imported)*c.buy;
  const credit=c.exportMode==='market'?rows.reduce((sum,r)=>sum+r.export*(p.get(r.t)+c.exportAdjustment),0):(net?Math.max(0,exported-imported):exported)*c.sell;
  const fixed=ehTariffFixedCost(c,limits),exportCost=exported*c.exportFee;
  return {contract:c,reason:null,total:purchase-credit+fixed+exportCost,purchase,credit,fixed,exportCost};
 });
 const reference=results.find(r=>r.contract.reference);
 results.sort((a,b)=>(a.total===null?Infinity:a.total)-(b.total===null?Infinity:b.total));
 return {results,reference,imported,exported,coverage:expected?valid.length/expected:0,complete};
}
// Separate, read-only comparison: what each saved alternative would have cost
// against the configured reference over the exact same complete P1 period.
function ehCompareSavings(result){
 const reference=result?.reference||null;
 if(!reference)return {reference:null,rows:[]};
 return {reference,rows:result.results.filter(r=>r.contract.id!==reference.contract.id).map(r=>({
  contract:r.contract,total:r.total,reason:r.reason,
  delta:Number.isFinite(reference.total)&&Number.isFinite(r.total)?r.total-reference.total:null
 }))};
}
function ehCompareSavingsHtml(result,contracts){
 const configured=(contracts||[]).find(c=>c.reference);
 if(!contracts?.length)return '';
 const heading='<h3>Jouw voordeel of nadeel</h3>';
 if(!configured)return '<section class="ehcmp-savings" aria-label="Kostenverschillen">'+heading+
  '<p class="subtle">Stel Zonneplan eerst in als referentie om de euroverschillen met je andere contracten te zien.</p></section>';
 const name=ehEsc(configured.name);
 if(!result)return '<section class="ehcmp-savings" aria-label="Kostenverschillen">'+heading+
  '<p class="subtle">Verschillen met '+name+' verschijnen zodra de gekozen periode volledig is doorgerekend.</p></section>';
 const comparison=ehCompareSavings(result),reference=comparison.reference;
 if(!reference||!Number.isFinite(reference.total))return '<section class="ehcmp-savings" aria-label="Kostenverschillen">'+heading+
  '<p class="subtle">Nog geen betrouwbaar verschil te berekenen: '+ehEsc(reference?.reason||'referentiekosten ontbreken')+'.</p></section>';
 if(!comparison.rows.length)return '<section class="ehcmp-savings" aria-label="Kostenverschillen">'+heading+
  '<p class="subtle">'+name+' is ingesteld. Voeg een extra stroomcontract toe om het voordeel of nadeel te zien.</p></section>';
 const rows=comparison.rows.map(r=>{
  const delta=r.delta,available=Number.isFinite(delta),equal=available&&Math.abs(delta)<.005;
  const outcome=!available?'Verschil niet beschikbaar':equal?'Even duur':ehEuro2(Math.abs(delta))+(delta>0?' voordeliger':' duurder');
  const status=!available?'':equal?'ehcmp-savings-equal':delta>0?'ehcmp-savings-good':'ehcmp-savings-bad';
  const explanation=!available?ehEsc(r.reason||'Tarief- of meetgegevens ontbreken'):equal?'met '+name:'met '+name;
  return '<div class="ehcmp-savings-row"><div class="ehcmp-savings-contract"><strong>'+ehEsc(r.contract.name)+'</strong>'+
   '<small>'+(Number.isFinite(r.total)?'Contract '+ehEuro2(r.total):'Contractkosten onbekend')+'</small></div>'+
   '<div class="ehcmp-savings-difference '+status+'"><strong>'+outcome+'</strong><small>'+explanation+'</small></div></div>';
 }).join('');
 return '<section class="ehcmp-savings" aria-label="Kostenverschillen">'+heading+
  '<p class="ehcmp-savings-reference">'+name+': <strong>'+ehEuro2(reference.total)+'</strong> over de gekozen periode</p>'+
  '<div class="ehcmp-savings-rows">'+rows+'</div>'+
  '<p class="subtle ehcmp-savings-foot">Scenario met je gemeten P1-uren en ingevoerde tarieven. Positief = '+name+
  ' goedkoper; negatief = een ander contract goedkoper. Geen werkelijke jaarafrekening; bonussen, saldering en ontbrekende kosten kunnen afwijken.</p></section>';
}
function ehCompareInputNumber(value){
 const text=String(value??'').trim();
 if(!text)return null;
 return /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)?Number(text.replace(',','.')):NaN;
}
function ehCompareField(name,label,value='',type='number'){
 const numeric=type==='number';
 return `<label>${ehEsc(label)}<input name="${name}" aria-label="${ehEsc(label)}" type="${numeric?'text':type}" ${numeric?'data-ehcmp-number inputmode="decimal"':''} value="${ehEsc(value??'')}" ${numeric||['name','priceEntity'].includes(name)?'required':''}></label>`;
}
function ehCompareValidateForm(form){
 for(const field of form.querySelectorAll('[aria-invalid]'))field.removeAttribute('aria-invalid');
 for(const field of form.querySelectorAll('input,select')){
  const label=field.getAttribute('aria-label')||field.name;
  let message='';
  if(field.name==='sourceConfirmed'&&!field.checked)message='Bevestig dat je de brongegevens hebt gecontroleerd.';
  else if(field.required&&!String(field.value||'').trim())message='Vul '+label+' in. Gebruik bij kosten expliciet 0 als ze niet gelden.';
  else if(field.hasAttribute('data-ehcmp-number')&&!Number.isFinite(ehCompareInputNumber(field.value)))message='Vul bij '+label+' een geldig bedrag in, bijvoorbeeld 0,25 of 0.25.';
  else if(!field.validity.valid)message='Controleer '+label+': '+field.validationMessage;
  if(message){field.setAttribute('aria-invalid','true');const error=new Error(message);error.field=field;throw error;}
 }
}
function ehCompareShowFormError(form,error){
 const alert=form.querySelector('[data-ehcmp-error]');
 if(alert){alert.textContent=error.message||'Opslaan is niet gelukt. Je invoer blijft behouden.';alert.hidden=false;alert.scrollIntoView({block:'center'});alert.focus({preventScroll:true});}
 if(error.field){error.field.focus({preventScroll:true});error.field.scrollIntoView({block:'center'});}
}
function ehCompareForm(c){
 const dynamic=c.type==='dynamic',basis=c.priceBasis||'retail',market=basis==='market',components=basis==='components';
 const monthly=c.fixedPeriod==='monthly',exportMarket=c.exportMode==='market';
 return `<form data-ehcmp-form novalidate><h3>${c.id?'Contract bewerken':'Contract toevoegen'}</h3><input type="hidden" name="id" value="${ehEsc(c.id||'')}">
 ${c.source?`<details class="ehcmp-info" open><summary>Brongegevens controleren</summary>${ehTariffSourceHtml(c.source,true)}</details>`:''}
 <div class="ehcmp-fields">${ehCompareField('name','Naam',c.name,'text')}
 <label>Contracttype<select name="type" data-ehcmp-form-select><option value="fixed" ${!dynamic?'selected':''}>Vast tarief</option><option value="dynamic" ${dynamic?'selected':''}>Dynamisch · historische uurprijzen</option></select></label>
 <label>Prijsgrondslag<select name="priceBasis" data-ehcmp-form-select><option value="retail" ${basis==='retail'?'selected':''}>Volledige afnameprijs incl. btw en belasting</option>${dynamic?`<option value="market" ${market?'selected':''}>Kale beursprijs incl. btw + losse kosten</option>`:`<option value="components" ${components?'selected':''}>Levering incl. btw + losse energiebelasting</option>`}</select></label>
 ${dynamic?ehCompareField('priceEntity',market?'Kale beursprijssensor (€/kWh incl. btw)':'Volledige afnameprijssensor (€/kWh)',c.priceEntity,'text'):components?ehCompareField('delivery','Levering zonder energiebelasting (€/kWh incl. btw)',c.delivery):ehCompareField('buy','Vaste afnameprijs (€/kWh)',c.buy)}
 ${components||market?ehCompareField('tax','Energiebelasting (€/kWh incl. btw)',c.tax):''}${market?ehCompareField('markup','Inkoopopslag (€/kWh incl. btw)',c.markup):''}
 ${market?`<label>Terugleverprijs<select name="exportMode" data-ehcmp-form-select><option value="fixed" ${!exportMarket?'selected':''}>Vaste vergoeding</option><option value="market" ${exportMarket?'selected':''}>Kale beursprijs + correctie</option></select></label>`:''}
 ${exportMarket?ehCompareField('exportAdjustment','Correctie teruglevering (€/kWh, negatief = inhouding)',c.exportAdjustment):ehCompareField('sell','Terugleververgoeding (€/kWh)',c.sell)}
 ${ehCompareField('exportFee','Extra terugleverkosten (€/kWh)',c.exportFee)}
 <label>Vaste kosten<select name="fixedPeriod" data-ehcmp-form-select><option value="daily" ${!monthly?'selected':''}>Per dag</option><option value="monthly" ${monthly?'selected':''}>Per maand</option></select></label>
 ${monthly?ehCompareField('monthly','Vaste leverancierskosten (€/maand)',c.monthly):ehCompareField('daily','Vaste leverancierskosten (€/dag)',c.daily)}
 <label>Verrekenmethode<select name="settlement"><option value="separate" ${c.settlement!=='net'?'selected':''}>Afname en teruglevering apart</option>${!dynamic?`<option value="net" ${c.settlement==='net'?'selected':''}>Saldo over gekozen periode (vast tarief)</option>`:''}</select></label>
 ${ehCompareField('from','Geldig vanaf (optioneel)',c.from,'date')}${ehCompareField('to','Geldig t/m (optioneel)',c.to,'date')}</div>
 ${market?'<p class="plan-warning">Gebruik een kale beursprijssensor inclusief btw, zonder energiebelasting of leveranciersopslag. De volledige Zonneplan-afnameprijs is hiervoor ongeschikt. Teruglevercorrectie wordt één keer toegevoegd; vul extra terugleverkosten alleen in als deze daarnaast gelden.</p>':''}
 <label class="ehcmp-check"><input type="checkbox" name="reference" ${c.reference?'checked':''}>Dit is mijn Zonneplan-referentie</label>
 ${c.source?`<label class="ehcmp-check"><input type="checkbox" name="sourceConfirmed" required ${c.sourceConfirmed?'checked':''}>Ik heb bronbedragen, ontbrekende kosten, belasting, verrekenmethode en toepasselijke periode gecontroleerd.</label>`:''}
 <p class="subtle">Tarieven inclusief btw waar van toepassing. Uurprijzen leveren een indicatie. Saldo is een scenario over de gekozen periode, geen jaarafrekening. Welkomstkortingen, staffels en wijzigingen binnen de periode worden niet berekend. Maandkosten worden per kalenderdag naar rato verdeeld.</p>
 <p data-ehcmp-error role="alert" tabindex="-1" hidden></p><div class="ehcmp-actions"><button type="submit">Contract opslaan</button><button type="button" data-ehcmp-action="cancel">Annuleren</button></div></form>`;
}
function ehCompareDraft(form,previous={}){
 const data=new FormData(form),num=name=>ehCompareInputNumber(data.get(name));
 const result={...previous};
 for(const key of ['id','name','type','priceBasis','priceEntity','exportMode','fixedPeriod','settlement','from','to'])if(data.has(key))result[key]=String(data.get(key));
 for(const key of ['buy','sell','exportFee','daily','monthly','delivery','tax','markup','exportAdjustment'])if(data.has(key))result[key]=num(key);
 result.reference=data.has('reference');result.sourceConfirmed=data.has('sourceConfirmed');result.pending=false;delete result.pendingReason;return result;
}

function ehCompareTariffPreview(contracts){
 if(!contracts?.length)return '<p class="subtle">Selecteer bijvoorbeeld ANWB, Essent of Eneco via Aanbieder uit tarievenlijst. Pas na opslaan worden de beschikbare contracttarieven hier getoond.</p>';
 const tiles=contracts.map(c=>{
  const fixed=c.type==='fixed';
  const unit=fixed&&Number.isFinite(c.buy)?ehEuro2(c.buy)+'/kWh':null;
  const markup=Number.isFinite(c.markup)?ehFmt(c.markup,4)+' €/kWh opslag':'opslag onbekend';
  const tax=Number.isFinite(c.tax)?ehFmt(c.tax,4)+' €/kWh belasting':'belasting onbekend';
  const headline=fixed?(unit||'Vast tarief onbekend'):c.priceBasis==='market'?'Kale beursprijs + '+markup+' + '+tax:'Dynamisch · uurprijs uit sensor';
  const fixedFees=c.fixedPeriod==='monthly'&&Number.isFinite(c.monthly)?ehEuro2(c.monthly)+'/maand':c.fixedPeriod==='daily'&&Number.isFinite(c.daily)?ehEuro2(c.daily)+'/dag':'vaste kosten onbekend';
  const checked=c.source?.checked?' · broncontrole '+c.source.checked:' · handmatig contract';
  const state=c.pending?'Nog niet berekenbaar: '+c.pendingReason:'Indicatief tarief; volledig kostenverschil vereist complete P1- en prijshistorie';
  return '<article class="ehcmp-tariff"><strong>'+ehEsc(c.name)+'</strong>'+
   (c.reference?'<small>Ingestelde referentie</small>':'')+
   '<span>'+ehEsc(headline)+'</span><small>Vaste leverancierskosten '+ehEsc(fixedFees)+ehEsc(checked)+'</small>'+
   '<small>'+ehEsc(state)+'</small></article>';
 }).join('');
 return '<section class="ehcmp-tariffs" aria-label="Opgeslagen leveranciers en tarieven"><h3>Contracttarieven</h3><div class="ehcmp-tariff-grid">'+tiles+'</div><p class="subtle">Dit zijn opgeslagen bron- of handmatige tarieven, geen actuele persoonlijke offertes. Dynamische totaalprijzen hangen af van de uurprijzen en belasting. Controleer bij een overstap ook saldering, terugleverkosten en geldigheidsdatum.</p></section>';
}
function ehCompareHtml(card){
 if(card._ehcatOpen)return `<section class="ehcmp"><button type="button" data-ehcat-action="close">← Leveranciersvergelijking</button>${ehTariffCatalogueHtml(card)}</section>`;
 const list=card._ehcmpContracts||[],data=card._ehcmpData;
 let limits,error='';try{limits=ehCompareDates(card._ehcmpPeriod||'month',card._ehcmpStart,card._ehcmpEnd);}catch(e){error=e.message;}
 const result=data&&limits&&data.key===`${+limits.from}|${+limits.to}`&&!data.error?ehCompareCalculate(list,data.rows,data.prices,limits):null;
 const ready=result?.results.filter(r=>r.total!==null)||[];
 const min=Math.min(0,...ready.map(r=>r.total)),max=Math.max(0,...ready.map(r=>r.total)),span=max-min||1,zero=-min/span*100;
 const bars=result?result.results.map(r=>{
  const c=r.contract,delta=result.reference?.total!==null&&result.reference?.total!==undefined&&r.total!==null?r.total-result.reference.total:null;
  const value=r.total===null?'—':ehEuro2(r.total);
  const start=r.total===null?zero:Math.min(0,r.total)-min;
  const bar=r.total===null?'':`<span class="ehcmp-track"><i class="ehcmp-zero" style="left:${zero}%"></i><i class="ehcmp-bar" style="left:${start/span*100}%;width:${Math.abs(r.total)/span*100}%"></i></span>`;
  return `<details class="ehcmp-result"><summary><span><b>${ehEsc(c.name)}</b>${c.reference?' · referentie':''}</span><strong>${value}</strong>${bar}<small>${r.reason?ehEsc(r.reason):c.reference?'Referentie':delta===null?'Geen complete Zonneplan-referentie':Math.abs(delta)<.005?'Gelijk aan Zonneplan':ehEuro2(Math.abs(delta))+(delta<0?' goedkoper':' duurder')+' dan Zonneplan'}</small></summary>${ehTariffSourceHtml(c.source)}${r.total===null?'':`<div class="subrows"><div><span>Afname</span><strong>${ehEuro2(r.purchase)}</strong></div><div><span>Terugleververgoeding (aftrek)</span><strong>${ehEuro2(r.credit)}</strong></div><div><span>Terugleverkosten</span><strong>${ehEuro2(r.exportCost)}</strong></div><div><span>Vaste leverancierskosten</span><strong>${ehEuro2(r.fixed)}</strong></div></div>`}<div class="ehcmp-actions"><button type="button" data-ehcmp-edit="${ehEsc(c.id)}">Bewerken</button><button type="button" data-ehcmp-delete="${ehEsc(c.id)}">Verwijderen</button></div></details>`;
 }).join(''):'';
 const manage=!result?list.map(c=>`<div class="ehcmp-actions"><span>${ehEsc(c.name)}</span><button type="button" data-ehcmp-edit="${ehEsc(c.id)}">Bewerken</button><button type="button" data-ehcmp-delete="${ehEsc(c.id)}">Verwijderen</button></div>`).join(''):'';
 return `<section class="ehcmp"><div class="subpage-head"><div><div class="eyebrow">Alleen stroom</div><h3>Leveranciers vergelijken</h3><p>Zonneplan versus je opgeslagen stroomcontracten. Tarieven direct, kosten op volledige meetdagen.</p></div></div>
 <div class="ehcmp-actions">${[['month','Deze maand'],['year','Dit jaar'],['custom','Eigen periode']].map(([p,n])=>`<button type="button" data-ehcmp-period="${p}" ${card._ehcmpEditing?'disabled':''} aria-pressed="${(card._ehcmpPeriod||'month')===p}">${n}</button>`).join('')}</div>
 ${(card._ehcmpPeriod==='custom')?`<div class="ehcmp-fields ehcmp-dates"><label>Van<input data-ehcmp-date="start" ${card._ehcmpEditing?'disabled':''} type="date" value="${ehEsc(card._ehcmpStart||'')}"></label><label>Tot en met<input data-ehcmp-date="end" ${card._ehcmpEditing?'disabled':''} type="date" value="${ehEsc(card._ehcmpEnd||'')}"></label></div>`:''}
 <p class="subtle">Afgeronde dagen, in de tijdzone van dit apparaat (${ehEsc(Intl.DateTimeFormat().resolvedOptions().timeZone)}). ${limits?ehEsc(limits.from.toLocaleDateString('nl-NL'))+' t/m '+ehEsc(new Date(+limits.to-1).toLocaleDateString('nl-NL')):''}</p>
 <details class="ehcmp-info"><summary>Indicatieve stroomkosten · uitleg</summary><p>Dit zijn leverancierskosten, geen volledige energienota. Uurprijzen kunnen afwijken van kwartierafrekening. Netbeheer, belastingvermindering, kortingen en niet ingevoerde kosten zijn uitgesloten. Controleer de verrekenmethode van elk contract.</p></details>
 ${card._ehcmpMessage?`<p role="status">${ehEsc(card._ehcmpMessage)}</p>`:''}
 ${card._ehcmpEditing?ehCompareForm(card._ehcmpEditing):`<div class="ehcmp-actions"><button type="button" data-ehcat-action="open">Aanbieder uit tarievenlijst</button><button type="button" data-ehcmp-action="add">+ Eigen contract</button>${!list.some(c=>c.reference&&/zonneplan/i.test(c.name))?'<button type="button" data-ehcmp-action="zonneplan">Zonneplan als referentie</button>':''}<button type="button" data-ehcmp-action="refresh">Vernieuwen</button><button type="button" data-ehcmp-action="transfer">Export / import</button></div>`}
 ${ehTariffCatalogueHtml(card)}
 ${card._ehcmpTransfer?`<label>Contracten als JSON (geen meetgegevens)<textarea data-ehcmp-json rows="6">${ehEsc(JSON.stringify({version:1,contracts:list},null,2))}</textarea></label><div class="ehcmp-actions"><button type="button" data-ehcmp-action="download">Download JSON</button><button type="button" data-ehcmp-action="import">JSON toevoegen / bijwerken</button></div>`:''}
 ${error?`<p class="plan-warning">${ehEsc(error)}</p>`:card._ehcmpLoading?'<p role="status">P1- en prijshistorie ophalen…</p>':data?.error?`<p class="plan-warning">${ehEsc(data.error)}</p>`:''}
 ${result?`<p class="subtle">Meetdekking: ${ehFmt(result.coverage*100,1)}% · Afname ${ehFmt(result.imported,1)} kWh · Teruglevering ${ehFmt(result.exported,1)} kWh${result.complete?'':' (onvolledig)'}. ${ready.length===list.length&&ready.length>1?'Laagste berekende kosten van de ingevoerde contracten: '+ehEsc(ready[0].contract.name)+'.':'Geen volledige ranglijst zolang gegevens ontbreken.'}</p>`:''}
 ${list.some(c=>c.reference&&!/zonneplan/i.test(c.name))?'<p class="plan-warning">De ingestelde referentie is geen Zonneplan. Kies Zonneplan als referentie voor een juiste vergelijking.</p>':''}
 ${ehCompareSavingsHtml(result,list)}
 ${ehCompareTariffPreview(list)}
 ${bars}${manage}${!list.length?'<div class="subsection"><h3>Voeg je eerste contract toe</h3><p>Neem tarieven over uit je aanbod. Stel daarna Zonneplan in als referentie. De contractvergelijking verschijnt hierboven zodra de meetgegevens volledig zijn.</p></div>':''}
 <p class="subtle">Contracten blijven alleen in deze browser / app op dit apparaat. Exporteer een back-up voor andere apparaten. Geen meetgeschiedenis of inloggegevens opgeslagen.</p></section>`;
}
function ehCompareCss(){return `.ehcmp-tariffs{margin:12px 0}.ehcmp-tariffs h3{font-size:16px;margin:0 0 10px}.ehcmp-tariff-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:9px}.ehcmp-tariff{min-width:0;padding:12px;border-radius:11px;border:1px solid #64899b77;background:#0c2b3b;display:flex;flex-direction:column;gap:6px;overflow-wrap:anywhere}.ehcmp-tariff strong{font-size:14px}.ehcmp-tariff span{font-size:13px;color:#c1f7e1;font-weight:650}.ehcmp-tariff small{font-size:11px;color:#b6d6df}.ehcat-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}.ehcat-quick{padding:12px;border:1px solid #64899b66;border-radius:12px;display:flex;flex-direction:column;gap:7px}.ehcat-quick small{color:#b6d6df}.ehcat-quick p{margin:5px 0}.ehcat-picker select{width:100%}.ehcat [data-ehcat-action=save-selected]:disabled{opacity:.5;cursor:not-allowed}@media(max-width:520px){.ehcat-picker{grid-template-columns:1fr}}.ehcmp{min-width:0}.ehcmp button,.ehcmp-entry{font:inherit;min-height:44px;border:1px solid #64899b;border-radius:10px;background:#123345;color:#ecf9ff;padding:9px 12px;cursor:pointer}.ehcmp button[aria-pressed="true"]{background:#17523f;border-color:#62dfb5}.ehcmp-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0}.ehcmp-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ehcmp label{display:flex;flex-direction:column;gap:6px;font-size:12px;min-width:0}.ehcmp [data-ehcmp-error]{padding:12px;border:1px solid #ffb5a7;border-radius:8px;color:#ffddd5;background:#402323}.ehcmp [aria-invalid="true"]{border-color:#ffb5a7;outline:2px solid #ffb5a7}.ehcmp input,.ehcmp select,.ehcmp textarea{box-sizing:border-box;width:100%;min-width:0;max-width:100%;font:inherit;font-size:16px;padding:10px;border-radius:8px;border:1px solid #64899b;background:#092535;color:#ecf9ff}.ehcmp .ehcmp-check{flex-direction:row;align-items:center;margin:14px 0}.ehcmp-check input{width:auto}.ehcmp-savings{border:1px solid #64899b88;border-radius:12px;padding:12px;margin:12px 0;background:#0d2938}.ehcmp-savings h3{font-size:16px;margin:0 0 6px}.ehcmp-savings-reference{margin:4px 0 12px;font-size:13px}.ehcmp-savings-rows{display:grid;gap:0}.ehcmp-savings-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #64899b44}.ehcmp-savings-contract{min-width:0;flex:1}.ehcmp-savings-contract strong{display:block;overflow-wrap:anywhere;font-size:13px}.ehcmp-savings-contract small,.ehcmp-savings-difference small{display:block;font-size:11px;color:#b6d6df}.ehcmp-savings-difference{text-align:right;max-width:55%;min-width:0}.ehcmp-savings-difference strong{font-size:14px;overflow-wrap:anywhere}.ehcmp-savings-good strong{color:#79e5bb}.ehcmp-savings-bad strong{color:#ffaf96}.ehcmp-savings-equal strong{color:#c7deea}.ehcmp-savings-foot{margin:10px 0 0;font-size:11px;line-height:1.45}@media(max-width:380px){.ehcmp-savings-row{gap:8px}.ehcmp-savings-difference{max-width:53%}.ehcmp-savings-difference strong{font-size:13px}}.ehcmp-result{border:1px solid #64899b55;border-radius:12px;padding:12px;margin:10px 0;overflow-wrap:anywhere}.ehcmp-result summary{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;cursor:pointer;min-height:44px}.ehcmp-result summary small,.ehcmp-track{grid-column:1/-1}.ehcmp-track{display:block;position:relative;height:16px;background:#081e2c;border-radius:4px}.ehcmp-bar{position:absolute;height:12px;top:2px;background:#53dbae;border-radius:3px}.ehcmp-zero{position:absolute;top:0;height:100%;width:1px;background:#d7eaff}.ehcmp button:focus-visible,.ehcmp summary:focus-visible{outline:2px solid #fff;outline-offset:3px}.ehcmp-info{font-size:12px;color:#ffdcaa;margin:10px 0}.ehcmp-info summary{cursor:pointer;min-height:32px;display:flex;align-items:center}.ehcmp-info summary:before{content:"▸";margin-right:6px}.ehcmp-info[open] summary:before{content:"▾"}.ehcmp-info p{line-height:1.5;margin-top:0}.ehcat h3{margin:0}.ehcat-list{max-height:360px;overflow:auto;overscroll-behavior:contain;margin:12px 0}.ehcat-list article{border-bottom:1px solid #64899b66;padding:12px 0;display:flex;flex-direction:column;gap:8px}.ehcat-source{font-size:12px;color:#aecbd8;line-height:1.5;margin:8px 0;overflow-wrap:anywhere}.ehcmp a{color:#8fdcc6}.ehcmp-info li{margin:8px 0}.ehcmp-entry{width:100%;margin:8px 0 12px;text-align:left}@media(max-width:520px){.ehcmp-fields{grid-template-columns:1fr}.ehcmp-fields.ehcmp-dates{grid-template-columns:repeat(2,minmax(0,1fr))}}`;}
(function ehCompareInstall(){
 const P=EnergiehuisCard.prototype,oldCosts=P._costsHtml,oldRender=P._render,oldConfig=P.setConfig;
 P.setConfig=function(config){this._ehcmpRequest=(this._ehcmpRequest||0)+1;this._ehcmpData=null;this._ehcmpLoading=false;return oldConfig.call(this,config);};
 P._ehcmpInit=function(){
  if(this._ehcmpContracts)return;
  try{const stored=window.localStorage?.getItem(EH_COMPARE_STORAGE);this._ehcmpContracts=stored?ehCompareList(JSON.parse(stored).contracts):[];}
  catch(_){this._ehcmpContracts=[];this._ehcmpMessage='Contractopslag kon niet worden gelezen. Exporteer je gegevens voordat je opnieuw opslaat.';}
 };
 P._ehcmpSave=function(list){
  const checked=ehCompareList(list);
  if(!window.localStorage)throw new Error('Browseropslag is niet beschikbaar. Contract niet opgeslagen.');
  window.localStorage.setItem(EH_COMPARE_STORAGE,JSON.stringify({version:1,contracts:checked}));
  this._ehcmpContracts=checked;this._ehcmpEditing=null;this._ehcmpMessage='Contracten opgeslagen op dit apparaat.';this._ehcmpLoad();this._schedule();
 };
 P._ehcmpLoad=async function(){
  const request=this._ehcmpRequest=(this._ehcmpRequest||0)+1;
  this._ehcmpLoading=false;this._ehcmpData=null;
  let limits;try{limits=ehCompareDates(this._ehcmpPeriod||'month',this._ehcmpStart,this._ehcmpEnd);}catch(_){this._schedule();return;}
  const key=`${+limits.from}|${+limits.to}`,h=this._hass,c=this.config;
  if(!h?.callWS||!c?.import||!c?.export){this._ehcmpData={key,error:'P1-sensoren of Home Assistant-verbinding ontbreken.'};this._schedule();return;}
  this._ehcmpLoading=true;this._schedule();
  const ids=[...new Set((this._ehcmpContracts||[]).filter(c=>c.type==='dynamic'&&!c.pending&&c.priceEntity).map(c=>c.priceEntity))];
  try{
   const calls=[h.callWS({type:'recorder/statistics_during_period',start_time:new Date(+limits.from-3600000).toISOString(),end_time:limits.to.toISOString(),statistic_ids:[c.import,c.export],period:'hour',types:['change','sum']})];
   for(const id of ids)calls.push(h.callWS({type:'recorder/statistics_during_period',start_time:limits.from.toISOString(),end_time:limits.to.toISOString(),statistic_ids:[id],period:'hour',types:['mean']}));
   const responses=await Promise.allSettled(calls);
   if(request!==this._ehcmpRequest)return;
   if(responses[0].status!=='fulfilled')throw new Error('P1-statistieken konden niet worden opgehaald. Controleer Recorder.');
   const prices={};
   ids.forEach((id,i)=>{const factor=eh20PriceUnit(h,id),map=new Map();prices[id]=map;if(factor===null||responses[i+1].status!=='fulfilled')return;for(const row of responses[i+1].value?.[id]||[]){const t=eh20PriceTime(row.start),p=ehNum(row.mean);if(Number.isFinite(t)&&p!==null)map.set(t,p*factor);}});
   this._ehcmpData={key,limits,rows:ehCompareRows(responses[0].value,c,h,limits),prices};
  }catch(e){if(request===this._ehcmpRequest)this._ehcmpData={key,error:e.message||'Historie niet beschikbaar.'};}
  finally{if(request===this._ehcmpRequest){this._ehcmpLoading=false;this._schedule();}}
 };
 P._costsHtml=function(h,c){
  this._ehcmpInit();
  return oldCosts.call(this,h,c);
 };
 P._render=function(){
  // Keep unfinished forms and transfers stable when HA delivers live state updates.
  if(this._view==='costs'&&(this._ehcmpEditing||this._ehcmpTransfer||this._ehcatOpen)&&this.shadowRoot?.querySelector?.('.ehcmp')&&!this._ehcmpForce)return;
  this._ehcmpForce=false;oldRender.call(this);
  const root=this.shadowRoot,style=root?.querySelector?.('style');if(style)style.textContent+='\n'+ehCompareCss();
  if(!root||this._ehcmpEvents)return;this._ehcmpEvents=true;
  const update=()=>{this._ehcmpForce=true;this._schedule();};
  root.addEventListener('submit',e=>{
   if(!e.target?.matches?.('[data-ehcmp-form]'))return;e.preventDefault();
   const form=e.target;
   try{
    ehCompareValidateForm(form);
    const draft=ehCompareDraft(form,this._ehcmpEditing||{});draft.id=draft.id||'contract-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
    const c=ehCompareContract(draft);
    this._ehcmpSave([...(this._ehcmpContracts||[]).filter(x=>x.id!==c.id).map(x=>c.reference?{...x,reference:false}:x),c]);update();
   }catch(err){ehCompareShowFormError(form,err);}
  });
  root.addEventListener('change',e=>{
   if(e.target?.matches?.('[data-ehcmp-form-select]')){const draft=ehCompareDraft(e.target.closest('form'),this._ehcmpEditing||{});if(e.target.name==='type'){draft.priceBasis='retail';draft.exportMode='fixed';draft.settlement='separate';}if(draft.priceBasis!=='market')draft.exportMode='fixed';this._ehcmpEditing=draft;update();return;}
   const key=e.target?.dataset?.ehcmpDate;if(!key)return;if(key==='start')this._ehcmpStart=e.target.value;else this._ehcmpEnd=e.target.value;this._ehcmpLoad();update();});
  root.addEventListener('click',e=>{
   const target=e.target?.closest?.('[data-ehcmp-action],[data-ehcmp-period],[data-ehcmp-edit],[data-ehcmp-delete]');if(!target)return;
   this._ehcmpInit();const d=target.dataset;
   try{
    if(d.ehcmpPeriod){this._ehcmpPeriod=d.ehcmpPeriod;this._ehcmpLoad();}
    if(d.ehcmpEdit){this._ehcatOpen=false;this._ehcmpTransfer=false;this._ehcmpEditing={...this._ehcmpContracts.find(c=>c.id===d.ehcmpEdit)};}
    if(d.ehcmpDelete){if(window.confirm('Dit contract uit de stroomvergelijker verwijderen?'))this._ehcmpSave(this._ehcmpContracts.filter(c=>c.id!==d.ehcmpDelete));}
    switch(d.ehcmpAction){
     case 'open':this._ehcmpOpen=true;this._ehcmpLoad();break;
     case 'back':this._ehcatOpen=false;this._ehcmpOpen=false;this._ehcmpEditing=null;this._ehcmpTransfer=false;break;
     case 'cancel':this._ehcmpEditing=null;break;
     case 'add':this._ehcatOpen=false;this._ehcmpTransfer=false;this._ehcmpEditing={type:'fixed',settlement:'separate'};break;
     case 'zonneplan':this._ehcatOpen=false;this._ehcmpTransfer=false;this._ehcmpEditing={name:'Zonneplan',type:'dynamic',settlement:'separate',priceEntity:this.config.prijs,reference:true};break;
     case 'refresh':this._ehcmpLoad();break;
     case 'transfer':this._ehcatOpen=false;this._ehcmpTransfer=!this._ehcmpTransfer;break;
     case 'download':{const blob=new Blob([JSON.stringify({version:1,contracts:this._ehcmpContracts},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='energiehuis-stroomcontracten.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;}
     case 'import':{const text=root.querySelector('[data-ehcmp-json]').value;if(text.length>1000000)throw new Error('Import is te groot.');const parsed=JSON.parse(text);if(parsed.version!==1)throw new Error('Onbekende exportversie.');const incoming=ehCompareList(parsed.contracts),merged=new Map(this._ehcmpContracts.map(c=>[c.id,c]));for(const c of incoming)merged.set(c.id,c);this._ehcmpSave([...merged.values()]);this._ehcmpTransfer=false;break;}
    }
   }catch(err){this._ehcmpMessage=err.message;}
   update();
  });
 };
})();

(function ehTariffInstall(){
 const P=EnergiehuisCard.prototype,render=P._render;
 P._ehcatLoad=async function(){
  if(this._ehcatLoading)return;
  this._ehcatLoading=true;this._ehcatError='';this._ehcmpForce=true;this._schedule();
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
  try{
   const get=async file=>{const response=await fetch(EH_TARIFF_DATA+file,{signal:abort.signal,credentials:'omit',cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);const text=await response.text();if(text.length>500000)throw new Error('Tarievenbestand te groot.');return JSON.parse(text);};
   const [dynamic,fixed,taxes]=await Promise.all([get('leveranciers.json'),get('vaste-contracten.json'),get('energiebelasting.json').catch(()=>null)]);
   this._ehcatTaxes=taxes;
   this._ehcatEntries=ehTariffCatalogue(dynamic,fixed);
  }catch(_){this._ehcatError='Tarieven konden niet worden opgehaald of het bronformaat is gewijzigd. Je opgeslagen contracten blijven beschikbaar.';}
  finally{clearTimeout(timer);this._ehcatLoading=false;if(this._ehcatOpen)this._ehcmpForce=true;this._schedule();}
 };
 P._render=function(){
  render.call(this);const root=this.shadowRoot;if(!root||this._ehcatEvents)return;this._ehcatEvents=true;
  const update=()=>{this._ehcmpForce=true;this._schedule();};
  root.addEventListener('change',e=>{if(e.target?.matches?.('[data-ehcat-filter]')){this._ehcatFilter=e.target.value;this._ehcatSelected='';update();}if(e.target?.matches?.('[data-ehcat-select]')){this._ehcatSelected=e.target.value;update();}});
  root.addEventListener('click',e=>{
   const button=e.target?.closest?.('[data-ehcat-action],[data-ehcat-add]');if(!button)return;
   if(button.dataset.ehcatAdd){const entry=this._ehcatEntries?.find(x=>x.id===button.dataset.ehcatAdd);if(entry){this._ehcmpEditing={...entry.draft,source:ehTariffSource(entry.source)};this._ehcatOpen=false;this._ehcmpTransfer=false;this._ehcmpMessage='Concept uit tarievenlijst. Controleer de bedragen en voorwaarden vóór opslaan.';}}
   switch(button.dataset.ehcatAction){
    case 'save-selected':{
     const entry=this._ehcatEntries?.find(x=>x.id===this._ehcatSelected);
     if(!entry){this._ehcatError='Kies eerst een geldig contract.';break;}
     try{
      const contract=ehTariffQuickContract(entry,this._ehcatTaxes,new Date().getFullYear(),this._ehcmpContracts||[]);
      this._ehcmpSave([...(this._ehcmpContracts||[]).filter(x=>x.id!==contract.id),contract]);
      this._ehcatOpen=false;this._ehcatSelected='';
      this._ehcmpMessage=contract.pending?'Contract opgeslagen. Nog niet berekenbaar: '+contract.pendingReason:'Contract opgeslagen als indicatief stroomscenario.';
     }catch(error){this._ehcatError='Opslaan mislukt: '+(error.message||'onbekende fout');}
     break;
    }
    case 'open':this._ehcmpEditing=null;this._ehcmpTransfer=false;this._ehcatOpen=true;if(!this._ehcatEntries)this._ehcatLoad();break;case 'refresh':this._ehcatLoad();break;case 'close':this._ehcatOpen=false;break;}
   update();
  });
 };
})();


