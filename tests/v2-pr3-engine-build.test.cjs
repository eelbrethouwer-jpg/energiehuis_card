'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const build=path.join(root,'scripts','build.cjs');
function run(dir,mode='--check'){
 return spawnSync(process.execPath,[build,mode,'--root='+dir],{encoding:'utf8',timeout:30000});
}
function fixture(testFn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'eh-v2-pr3-'));
 try{
  fs.mkdirSync(path.join(dir,'src'),{recursive:true});
  fs.cpSync(path.join(root,'src','legacy'),path.join(dir,'src','legacy'),{recursive:true});
  fs.cpSync(path.join(root,'src','engines'),path.join(dir,'src','engines'),{recursive:true});
  fs.copyFileSync(path.join(root,'energiehuis-card.js'),path.join(dir,'energiehuis-card.js'));
  return testFn(dir);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('PR3: manifest includes two explicit engines and recreates the HACS resource',()=>{
 const buildSource=fs.readFileSync(build,'utf8');
 const manifest=[...buildSource.matchAll(/\{kind:'engine',name:'([^']+)'\}/g)].map(m=>m[1]);
 assert.deepStrictEqual(manifest,['battery-engine.cjs','personal-evidence-engine.cjs']);
 assert.deepStrictEqual(fs.readdirSync(path.join(root,'src','engines')).sort(),manifest.slice().sort());
 assert.equal(run(root).status,0);
});
test('PR3: multiple engines remain fail-closed for unexpected files and missing required files',()=>fixture(dir=>{
 const engDir=path.join(dir,'src','engines');
 const extra=path.join(engDir,'extra.cjs');
 fs.writeFileSync(extra,'// unexpected\n');
 assert.match(run(dir).stderr,/engine source list differs/);
 fs.unlinkSync(extra);
 const required=path.join(engDir,'personal-evidence-engine.cjs');
 fs.unlinkSync(required);
 assert.match(run(dir).stderr,/engine source list differs/);
}));
test('PR3: syntax isolation catches unclosed engine hidden by following legacy fragment',()=>fixture(dir=>{
 const artifact=path.join(dir,'energiehuis-card.js');
 const before=fs.readFileSync(artifact);
 const engine=path.join(dir,'src','engines','personal-evidence-engine.cjs');
 const legacy=path.join(dir,'src','legacy','09-battery-finance.js');
 fs.appendFileSync(engine,'\nfunction accidentalUnclosed(){\n');
 fs.writeFileSync(legacy,'}\n'+fs.readFileSync(legacy,'utf8'));
 const write=run(dir,'--write');
 assert.notEqual(write.status,0,'an invalid engine cannot be committed as HACS output');
 assert.match(write.stderr,/standalone engine syntax invalid/);
 assert.equal(fs.readFileSync(artifact).equals(before),true);
 assert.equal(fs.readdirSync(dir).filter(x=>x.includes('.tmp-')).length,0);
 const check=run(dir,'--check');
 assert.notEqual(check.status,0);
 assert.equal(fs.readFileSync(artifact).equals(before),true);
}));
test('PR3: syntactically invalid legacy script is rejected even if engines parse',()=>fixture(dir=>{
 const artifact=path.join(dir,'energiehuis-card.js');
 const before=fs.readFileSync(artifact);
 fs.appendFileSync(path.join(dir,'src','legacy','09-battery-finance.js'),'\nfunction (\n');
 const result=run(dir,'--write');
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/generated HACS JavaScript syntax invalid/);
 assert.equal(fs.readFileSync(artifact).equals(before),true);
}));
test('PR3: valid --write is idempotent with all engines present',()=>fixture(dir=>{
 const output=path.join(dir,'energiehuis-card.js');
 const first=fs.readFileSync(output);
 const write=run(dir,'--write');
 assert.equal(write.status,0,write.stdout+write.stderr);
 assert.equal(fs.readFileSync(output).equals(first),true);
 assert.equal(run(dir).status,0);
}));
