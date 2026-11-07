'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const f=require('./fixtures/normative/dst-utc.json');
const hour=3600000;
const wallFormat=new Intl.DateTimeFormat('en-GB',{
 timeZone:f.zone,year:'numeric',month:'2-digit',day:'2-digit',
 hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});
const wall=iso=>{
 const fields=Object.fromEntries(wallFormat.formatToParts(new Date(iso)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return fields.year+'-'+fields.month+'-'+fields.day+' '+fields.hour+':'+fields.minute;
};
const hours=(a,b)=>(Date.parse(b)-Date.parse(a))/hour;
test('PR0 E6: Netherlands autumn local day has 25 independent UTC hours',()=>{
 const x=f.autumn;assert.equal(hours(x.fromUtc,x.untilUtc),x.hours);
 const points=Array.from({length:x.hours},(_,i)=>new Date(Date.parse(x.fromUtc)+i*hour).toISOString());
 assert.equal(points.length,25);assert.equal(wall(points[0]).slice(0,10),x.localDay);
 assert.ok(points.every(p=>wall(p).slice(0,10)===x.localDay));
 assert.equal(wall(x.untilUtc).slice(0,10),'2026-10-26');
});
test('PR0 E6: duplicated 02:30 maps to two distinct UTC instants',()=>{
 const x=f.autumn;
 assert.equal(x.duplicateUtc.length,2);assert.notEqual(...x.duplicateUtc);
 for(const instant of x.duplicateUtc)assert.equal(wall(instant),x.duplicateWall);
 assert.equal(hours(x.chargeFromUtc,x.chargeUntilUtc),x.chargeHours);
 assert.equal(wall(x.chargeFromUtc),'2026-10-24 23:00');
 assert.equal(wall(x.chargeUntilUtc),'2026-10-25 06:00');
});
test('PR0 E6: Netherlands spring local day has 23 UTC hours',()=>{
 const x=f.spring;assert.equal(hours(x.fromUtc,x.untilUtc),x.hours);
 const points=Array.from({length:x.hours},(_,i)=>new Date(Date.parse(x.fromUtc)+i*hour).toISOString());
 assert.ok(points.every(p=>wall(p).slice(0,10)===x.localDay));
 assert.equal(wall(x.untilUtc).slice(0,10),'2027-03-29');
});
test('PR0 E6: nonexistent spring 02:30 has no matching CEST/CET candidate',()=>{
 const [date,time]=f.spring.nonexistentWall.split(' ');
 const [y,m,d]=date.split('-').map(Number),[h,mm]=time.split(':').map(Number);
 const naiveUtc=Date.UTC(y,m-1,d,h,mm);
 for(const offset of [1,2])assert.notEqual(wall(new Date(naiveUtc-offset*hour).toISOString()),f.spring.nonexistentWall);
});
