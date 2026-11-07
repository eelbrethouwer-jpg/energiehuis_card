function eh30PersonalEvidence(rows){
 const sorted=(Array.isArray(rows)?rows:[]).filter(r=>Number.isFinite(r?.t)).slice().sort((a,b)=>a.t-b.t);
 const unique=new Map();let duplicates=0;
 for(const r of sorted){if(unique.has(r.t))duplicates++;else unique.set(r.t,r);}
 const samples=[...unique.values()];
 const start=samples[0]?.t??null,end=samples.length?samples[samples.length-1].end:null;
 const expected=start!==null&&Number.isFinite(end)&&end>start?Math.ceil((end-start)/3600000):0;
 const valid=samples.filter(r=>Number.isFinite(r.end)&&r.end-r.t===3600000&&Number.isFinite(r.import)&&r.import>=0&&Number.isFinite(r.export)&&r.export>=0);
 const priced=valid.filter(r=>Number.isFinite(r.price));
 const imported=valid.reduce((n,r)=>n+r.import,0),exported=valid.reduce((n,r)=>n+r.export,0);
 const months=new Set(valid.map(r=>new Date(r.t).toISOString().slice(0,7))).size;
 return {start,end,expected,valid:valid.length,priced:priced.length,duplicates,
  missing:Math.max(0,expected-valid.length),coverage:expected?Math.min(1,valid.length/expected):0,
  imported,exported,months};
}
// PR3: preserve global function declaration in HACS classic script; export for standalone Node only.
if(typeof module !== 'undefined' && module){
 try{
  if(module.exports)Object.assign(module.exports,{eh30PersonalEvidence});
 }catch(_){}
}
