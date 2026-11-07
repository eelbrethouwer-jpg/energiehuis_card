'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const build=path.join(root,'scripts','build.cjs');
const original=path.join(root,'energiehuis-card.js');
const src=path.join(root,'src','legacy');
function run(mode,dir=root){
 return spawnSync(process.execPath,[build,mode,'--root='+dir],{encoding:'utf8',timeout:30000});
}
function fixture(fn){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'energiehuis-pr1-'));
 try {
  fs.mkdirSync(path.join(temp,'src'),{recursive:true});
  fs.cpSync(src,path.join(temp,'src','legacy'),{recursive:true});
  fs.copyFileSync(original,path.join(temp,'energiehuis-card.js'));
  return fn(temp);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
test('PR1: source concatenation exactly reproduces deployed HACS JavaScript bytes',()=>{
 const sourceFiles=fs.readdirSync(src).filter(x=>x.endsWith('.js')).sort();
 assert.equal(sourceFiles.length,16);
 const current=fs.readFileSync(original);
 const r=run('--check');
 assert.equal(r.status,0,'Build parity: '+r.stdout+r.stderr);
 assert.match(r.stdout,/PASS: HACS bundle is byte-identical/);
 assert.equal(fs.readFileSync(original).equals(current),true,'--check must not touch shipped bundle');
});
test('PR1: generated file remains valid JavaScript and retains the unchanged public custom element',()=>{
 const syntax=spawnSync(process.execPath,['--check',original],{encoding:'utf8',timeout:30000});
 assert.equal(syntax.status,0,syntax.stderr);
 const source=fs.readFileSync(original,'utf8');
 assert.match(source,/customElements\.define\('energiehuis-card',EnergiehuisCard\)/);
 assert.match(source,/const EH_VERSION = '1\.24\.1';/);
 assert.match(source,/charge_control_enabled: false/);
});
test('PR1: changed HACS output is detected; --write deterministically restores it in isolated temp root',()=>fixture(dir=>{
 const output=path.join(dir,'energiehuis-card.js');
 fs.appendFileSync(output,'\n// synthetic tamper - tests only\n');
 const fail=run('--check',dir);
 assert.notEqual(fail.status,0,'Parity check must reject changed output');
 assert.match(fail.stderr,/not byte-identical/);
 const fix=run('--write',dir);
 assert.equal(fix.status,0,fix.stderr);
 assert.equal(fs.readFileSync(output).equals(fs.readFileSync(original)),true);
 assert.equal(run('--check',dir).status,0);
}));
test('PR1: unlisted source modules fail closed instead of silently being excluded',()=>fixture(dir=>{
 const extra=path.join(dir,'src','legacy','99-unlisted.js');
 fs.writeFileSync(extra,'// not in manifest\n');
 const fail=run('--check',dir);
 assert.notEqual(fail.status,0);
 assert.match(fail.stderr,/fragment list differs/);
}));
test('PR1: deleted source module fails closed; no partial output',()=>fixture(dir=>{
 const missing=path.join(dir,'src','legacy','08-battery-core.js');
 fs.unlinkSync(missing);
 assert.notEqual(run('--check',dir).status,0);
 assert.equal(fs.readFileSync(path.join(dir,'energiehuis-card.js')).equals(fs.readFileSync(original)),true);
}));
test('PR1: HACS package keeps the same entrypoint name; no build-time dependency',()=>{
 const h=JSON.parse(fs.readFileSync(path.join(root,'hacs.json'),'utf8'));
 assert.equal(h.filename,'energiehuis-card.js');
 const script=fs.readFileSync(build,'utf8');
 assert.doesNotMatch(script,/require\(['"](?:playwright|vite|esbuild|rollup|webpack)['"]\)/);
});
