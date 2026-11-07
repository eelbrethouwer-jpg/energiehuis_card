'use strict';
// After PR2 the original PR41 blob lock would forbid legitimate engine extraction.
// Replace it with generated bundle parity and preserved HA safety invariants.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const bundle=fs.readFileSync(path.join(root,'energiehuis-card.js'));
const engineFile=path.join(root,'src','engines','battery-engine.cjs');
test('PR41 integratie: HACS-bundel matches de gegenereerde modulaire bronnen',()=>{
 const check=spawnSync(process.execPath,[path.join(root,'scripts','build.cjs'),'--check'],{
  encoding:'utf8',timeout:30000
 });
 assert.equal(check.status,0,check.stdout+check.stderr);
 const src=bundle.toString('utf8');
 assert.match(src,/function eh24ChargeReading/);
 assert.match(src,/function eh20Simulate/);
 assert.match(src,/const EH_VERSION = '\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?'/);
});
test('PR41 integratie: historische veiligheids- en HACS-contracten blijven intact',()=>{
 const src=bundle.toString('utf8');
 assert.match(src,/charge_control_enabled:\s*false/);
 assert.match(src,/if\(!customElements\.get\('energiehuis-card'\)\)customElements\.define/);
 const hacs=JSON.parse(fs.readFileSync(path.join(root,'hacs.json'),'utf8'));
 assert.equal(hacs.filename,'energiehuis-card.js');
});
test('PR2 extractie: engine bestaat exact eenmaal in standalone bron en HACS-bundel',()=>{
 const src=bundle.toString('utf8'),engine=fs.readFileSync(engineFile,'utf8');
 for(const name of ['eh20Percentile','eh21BatteryProfile','eh20Simulate']){
  const declaration='function '+name+'(';
  assert.equal(src.split(declaration).length-1,1,name+' not exactly once in bundled script');
  assert.ok(engine.includes(declaration),name+' missing from standalone engine');
 }
});
