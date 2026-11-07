/* Read-only Recorder data audit. Requires explicit interaction; samples are not full-year proof. */
function eh25AuditSummary(rows){
 const list=Array.isArray(rows)?rows:[];
 const valid=list.filter(r=>Number.isFinite(r?.import)&&r.import>=0&&Number.isFinite(r?.export)&&r.export>=0);
 const prices=valid.filter(r=>Number.isFinite(r.price)).length;
 return {total:list.length,valid:valid.length,prices,completeDays:eh22BatteryCoverage(list).completeDays};
}
function eh25ProbeCoverage(reply,ids,from,to,minutes){
 const expected=Math.round((to-from)/(minutes*60000));
 const series=ids.map(id=>{
  const matching=new Set();
  for(const r of Array.isArray(reply?.[id])?reply[id]:[]){
   const t=eh20PriceTime(r.start),v=eh17N(r.change),sum=eh17N(r.sum);
   if(!Number.isFinite(t)||((v===null||v<0)&&(sum===null||sum<0)))continue;
   const idx=Math.floor((t-from)/(minutes*60000));
   if(idx>=0&&idx<expected)matching.add(idx);
  }
  return matching;
 });
 const valid=series.length===2?[...series[0]].filter(i=>series[1].has(i)).length:0;
 return {expected,valid,coverage:expected?valid/expected:0};
}
function eh25AuditHtml(card,h,c,rows){
 const data=eh25AuditSummary(rows),percent=(n,d)=>d?ehFmt(n/d*100,0)+'%':'—';
 const report=card._eh25Audit;
 const sample=(p)=>p?'<strong>'+p.valid+' / '+p.expected+' ('+percent(p.valid,p.expected)+')</strong>':'<strong>Niet vastgesteld</strong>';
 const detail=report?'<div class="eh25-audit-result">'+
  '<p>Vijfminutenstatistieken gisteren: '+sample(report.five)+(report.fiveError?' · '+ehEsc(report.fiveError):'')+'</p>'+
  '<p>Uurstatistieken circa één jaar geleden (7 dagen): '+sample(report.old)+(report.oldError?' · '+ehEsc(report.oldError):'')+'</p>'+
  '<p>'+(report.five?.coverage>=.8?'Vijfminutendata in deze proefdag grotendeels aanwezig; langere dekking nog onbekend.':'Geen voldoende volledige vijfminuten-proefdag aangetoond.')+'</p>'+
  '<p>'+(report.old?.coverage>=.8?'Oudere uurdata in deze steekproef aanwezig; een compleet jaar is niet bewezen.':'Nog onvoldoende bewijs voor een jaarweergave.')+'</p></div>':'';
 return '<details class="eh25-audit" aria-label="Batterij datakwaliteit controleren"'+(card._eh25Open?' open':'')+'>'+
  '<summary>Datakwaliteit · fijnere metingen en jaarhistorie</summary>'+
  '<p>P1-uurhistorie: <strong>'+data.valid+' / '+data.total+' ('+percent(data.valid,data.total)+')</strong> · '+data.completeDays+' volledige dagen.</p>'+
  '<p>Historische uurprijzen: <strong>'+data.prices+' / '+data.valid+' ('+percent(data.prices,data.valid)+')</strong>.</p>'+
  '<p class="eh25-small">Eenmalig en alleen op jouw verzoek: lees gisteren de 5-minutenstatistieken en een oudere week uurstatistieken. Geen apparaten of entiteiten worden gewijzigd.</p>'+
  '<button type="button" data-eh25-probe="1" '+(card._eh25Loading||!h?.callWS||!c?.import||!c?.export?'disabled':'')+'>'+(card._eh25Loading?'Controleren…':'Controleer mijn Recorder-data')+'</button>'+
  (card._eh25Error?'<p class="eh20-notice">'+ehEsc(card._eh25Error)+'</p>':'')+detail+
  '<p class="eh25-small">Steekproef, geen validatie van een compleet jaar. Bij onvolledige historie blijft de fijnere en jaarweergave uitgeschakeld.</p></details>';
}

