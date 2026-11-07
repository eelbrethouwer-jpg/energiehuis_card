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
const engineDir=path.join(root,'src','engines');
function run(mode,dir=root){
 return spawnSync(process.execPath,[build,mode,'--root='+dir],{encoding:'utf8',timeout:30000});
}
function fixture(fn){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'energiehuis-pr1-'));
 try {
  fs.mkdirSync(path.join(temp,'src'),{recursive:true});
  fs.cpSync(src,path.join(temp,'src','legacy'),{recursive:true});
  fs.cpSync(engineDir,path.join(temp,'src','engines'),{recursive:true});
  fs.copyFileSync(original,path.join(temp,'energiehuis-card.js'));
  return fn(temp);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
test('PR1: source concatenation exactly reproduces deployed HACS JavaScript bytes',()=>{
 const sourceFiles=fs.readdirSync(src).filter(x=>x.endsWith('.js')).sort();
 assert.equal(sourceFiles.length,17);
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

test('PR1: hidden, non-JS and other unexpected entries fail closed',()=>fixture(dir=>{
 const sourceDir=path.join(dir,'src','legacy');
 for(const name of ['notes.txt','unlisted.mjs','unlisted.cjs','.surprise']){
  const other=path.join(sourceDir,name);
  fs.writeFileSync(other,'// synthetic unexpected fixture\n');
  const fail=run('--check',dir);
  assert.notEqual(fail.status,0,'Unexpected '+name+' must fail');
  assert.match(fail.stderr,/fragment list differs/);
  fs.unlinkSync(other);
 }
}));
test('PR1: a non-existent --root fails gracefully, without a stack trace',()=>fixture(dir=>{
 const unknown=path.join(dir,'does-not-exist');
 const failure=run('--check',unknown);
 assert.notEqual(failure.status,0);
 assert.match(failure.stderr,/missing or unreadable source directory/);
 assert.doesNotMatch(failure.stderr,/node:fs|at Object\./);
}));
test('PR1: failure message identifies first byte difference and does not mutate source or HACS artifact',()=>fixture(dir=>{
 const file=path.join(dir,'energiehuis-card.js');
 const before=fs.readFileSync(file);
 const altered=Buffer.from(before);altered[0]=altered[0]===65?66:65;
 fs.writeFileSync(file,altered);
 const check=run('--check',dir);
 assert.notEqual(check.status,0);
 assert.match(check.stderr,/Eerste byteverschil op offset 0, bronregel 1/);
 assert.match(check.stderr,/Hint:/);
 assert.equal(fs.readFileSync(file).equals(altered),true);
 assert.equal(fs.readFileSync(path.join(dir,'src','legacy','00-foundation.js'))
  .equals(fs.readFileSync(path.join(root,'src','legacy','00-foundation.js'))),true);
}));
test('PR1: --write atomically replaces only the HACS output and cleans temporary file',()=>fixture(dir=>{
 const file=path.join(dir,'energiehuis-card.js');
 const before=fs.readFileSync(file);
 fs.writeFileSync(file,'// a manually changed artifact\n');
 const write=run('--write',dir);
 assert.equal(write.status,0,write.stderr);
 assert.match(write.stderr,/NOTICE: --write vervangt/);
 assert.equal(fs.readFileSync(file).equals(before),true);
 assert.equal(fs.readdirSync(dir).filter(n=>n.includes('.tmp-')).length,0);
}));
test('PR1: git attributes explicitly pin HACS and fragment EOLs to LF',()=>{
 const attrs=fs.readFileSync(path.join(root,'.gitattributes'),'utf8');
 assert.match(attrs,/^energiehuis-card\.js text eol=lf$/m);
 assert.match(attrs,/^src\/legacy\/\*\.js text eol=lf$/m);
});

test('PR2: standalone engine manifest rejects missing or extra engine sources',()=>fixture(dir=>{
 const d=path.join(dir,'src','engines');
 const extra=path.join(d,'extra.txt');
 fs.writeFileSync(extra,'unexpected\n');
 const reject=run('--check',dir);
 assert.notEqual(reject.status,0);
 assert.match(reject.stderr,/engine source list differs/);
 fs.unlinkSync(extra);
 const original=path.join(d,'battery-engine.cjs');
 fs.renameSync(original,original+'.bak');
 const missing=run('--check',dir);
 assert.notEqual(missing.status,0);
 assert.equal(fs.readFileSync(path.join(dir,'energiehuis-card.js'))
  .equals(fs.readFileSync(path.join(root,'energiehuis-card.js'))),true);
}));

test('PR2: invalid generated JavaScript is rejected BEFORE --write and leaves existing HACS intact',()=>fixture(dir=>{
 const artifact=path.join(dir,'energiehuis-card.js');
 const before=fs.readFileSync(artifact);
 const invalid=path.join(dir,'src','engines','battery-engine.cjs');
 fs.appendFileSync(invalid,'\nfunction (\n');
 const attempted=run('--write',dir);
 assert.notEqual(attempted.status,0,'Invalid engine must never exit successfully');
 assert.match(attempted.stderr,/generated HACS JavaScript syntax invalid/);
 assert.equal(fs.readFileSync(artifact).equals(before),true,'Valid existing HACS must stay byte-identical');
 assert.equal(fs.readdirSync(dir).filter(n=>n.includes('.tmp-')).length,0,'No partially-written HACS files');
 const checked=run('--check',dir);
 assert.notEqual(checked.status,0);
 assert.equal(fs.readFileSync(artifact).equals(before),true,'--check must be read-only on invalid JS');
}));
test('PR2: engine appears between battery inputs and chart in explicit build steps',()=>{
 const script=fs.readFileSync(build,'utf8');
 const a=script.indexOf("{kind:'legacy',name:'08-battery-core.js'}");
 const b=script.indexOf("{kind:'engine',name:'battery-engine.cjs'}");
 const c=script.indexOf("{kind:'legacy',name:'08-battery-chart.js'}");
 assert.ok(a>=0&&b>a&&c>b,'Engine build order must be explicit');
 assert.doesNotMatch(script,/name==='08-battery-chart.js'\?/);
});
