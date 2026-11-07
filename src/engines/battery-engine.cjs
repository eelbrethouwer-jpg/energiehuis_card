/* EnergieRegisseur PR2: browser-safe, standalone Node battery calculation core.
 * Historical numeric decisions remain unchanged. No HA, DOM, storage or network APIs.
 */
function ehBatteryNumber(v){if(v===null||v===undefined||v==="")return null;const n=typeof v==="number"?v:Number(String(v).replace(",","."));return Number.isFinite(n)?n:null;}
function eh20Percentile(values,q){
 if(!values.length)return null;
 const arr=values.slice().sort((a,b)=>a-b);
 return arr[Math.floor(Math.max(0,Math.min(1,q))*(arr.length-1))];
}
function eh21BatteryProfile(cap,config={}){
 const size=[5,10,15].includes(Number(cap))?Number(cap):10;
 const defaultPower=ehBatteryNumber(config.battery_sim_power_kw);
 const power=defaultPower!==null&&defaultPower>0?defaultPower:3;
 const option=(key,def,min,max)=>{
  const n=ehBatteryNumber(config['battery_'+size+'_'+key]);
  return n!==null&&n>=min&&n<=max?n:def;
 };
 const usablePct=option('usable_pct',100,1,100);
 return {capacity:size,usablePct,usableCapacity:size*usablePct/100,
  chargeKw:option('charge_kw',power,.1,20),
  dischargeKw:option('discharge_kw',power,.1,20)};
}
function eh20Simulate(rows,cap,roundtrip,power,mode,buy,sell,profile=null){
 const p=profile&&profile.capacity===cap?profile:eh21BatteryProfile(cap,{battery_sim_power_kw:power});
 const usable=Math.max(.01,Math.min(cap,p.usableCapacity));
 const chargeKw=p.chargeKw>0?p.chargeKw:3,dischargeKw=p.dischargeKw>0?p.dischargeKw:3;
 const eta=Number.isFinite(roundtrip)&&roundtrip>0&&roundtrip<=1?roundtrip:.88;
 const chargeEff=Math.sqrt(eta),dischargeEff=Math.sqrt(eta);
 const valid=rows.filter(r=>Number.isFinite(r.import)&&Number.isFinite(r.export)&&r.import>=0&&r.export>=0);
 const pricesComplete=valid.length>0&&valid.every(r=>Number.isFinite(r.price));
 if(mode==='smart'&&!pricesComplete)return null;
 const threshold=pricesComplete?eh20Percentile(valid.map(r=>r.price),.25):null;
 let soc=0,pvCharge=0,gridCharge=0,served=0,benefit=0,lostExport=0,lastEnd=null;
 let avoidedPurchase=0,gridPurchase=0;
 let pvNotStored=0,pvLimitedCapacity=0,pvLimitedPower=0,fullHours=0,peakSoc=0,energyAtGaps=0;
 const points=[];
 for(const r of rows){
  if(!Number.isFinite(r.import)||!Number.isFinite(r.export)||r.import<0||r.export<0){
   energyAtGaps+=soc;soc=0;lastEnd=null;points.push({t:r.t,soc:null});continue;
  }
  if(lastEnd!==null&&lastEnd!==r.t){energyAtGaps+=soc;soc=0;}
  lastEnd=r.end;
  const hours=Math.max(0,Math.min(1.1,(r.end-r.t)/3600000));
  const maxCharge=chargeKw*hours,maxDischarge=dischargeKw*hours;
  const price=pricesComplete?r.price:buy;
  let chargedSolar=0,chargedGrid=0,used=0,fullRejected=0,powerRejected=0;
  if(r.export>0){
   const space=Math.max(0,(usable-soc)/chargeEff);
   chargedSolar=Math.max(0,Math.min(r.export,maxCharge,space));
   soc+=chargedSolar*chargeEff;
   lostExport+=chargedSolar*sell;
   powerRejected=Math.max(0,r.export-Math.min(r.export,maxCharge));
   fullRejected=Math.max(0,Math.min(r.export,maxCharge)-chargedSolar);
   pvLimitedPower+=powerRejected;
   pvLimitedCapacity+=fullRejected;
   pvNotStored+=Math.max(0,r.export-chargedSolar);
   if(fullRejected>1e-7)fullHours++;
  }
  // An hour with export cannot also discharge: hourly P1 samples lack event order.
  if(r.export===0&&mode==='smart'&&price<=threshold){
   const future=valid.filter(v=>v.t>r.t&&v.t<r.t+24*3600000);
   const high=future.length?Math.max(...future.map(v=>v.price)):null;
   if(high!==null&&high*eta>price+.015){
    chargedGrid=Math.max(0,Math.min(maxCharge,(usable-soc)/chargeEff));
    soc+=chargedGrid*chargeEff;
    gridCharge+=chargedGrid;
    benefit-=chargedGrid*price;
    gridPurchase+=chargedGrid*price;
   }
  }
  if(r.export===0&&chargedGrid===0&&r.import>0){
   used=Math.max(0,Math.min(r.import,maxDischarge,soc*dischargeEff));
   soc-=used/dischargeEff;served+=used;benefit+=used*price;avoidedPurchase+=used*price;
  }
  soc=Math.max(0,Math.min(usable,soc));peakSoc=Math.max(peakSoc,soc);
  pvCharge+=chargedSolar;
  points.push({t:r.t,soc,chargedSolar,chargedGrid,discharged:used,
   import:r.import,export:r.export,price:r.price,fullRejected,powerRejected});
 }
 return {capacity:cap,usableCapacity:usable,usablePct:usable/cap*100,chargeKw,dischargeKw,
  mode,points,pvCharge,gridCharge,served,endingSoc:soc,peakSoc,pvNotStored,
  pvLimitedCapacity,pvLimitedPower,fullHours,unobservedResetKwh:energyAtGaps,
  savings:benefit-lostExport,avoidedPurchase,gridPurchase,lostExport,
  assumedPrices:!pricesComplete,priceComplete:pricesComplete,
  hours:valid.length,missingHours:rows.length-valid.length};
}
// Classic-script global functions remain available to Energiehuis; CommonJS exports for isolated tests.
if(typeof module !== 'undefined' && module && module.exports){
 module.exports={eh20Percentile,eh21BatteryProfile,eh20Simulate};
}
