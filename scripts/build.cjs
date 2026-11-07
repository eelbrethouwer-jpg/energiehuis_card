'use strict';
// PR1: byte-for-byte assembly of the legacy HACS resource. No transpilation,
// rewriting, whitespace normalisation, module wrappers or external packages.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const manifest=Object.freeze([
  '00-foundation.js','01-history-analytics.js','02-card-shell.js',
  '03-energy-intelligence.js','04-utility-sources.js','05-energy-insights.js',
  '06-mobile-shell.js','07-script-charge-controls.js','08-battery-core.js',
  '09-battery-finance.js','10-battery-flow.js','11-data-quality.js',
  '12-battery-forecast-ui.js','13-contracts.js','14-detail-state.js',
  '15-homewizard-history.js'
]);
const args=process.argv.slice(2),mode=args[0]||'--check';
if(!['--check','--write'].includes(mode)||args.length>2||
   (args[1]&&!args[1].startsWith('--root='))||
   (args[1]?.startsWith('--root=')&&args[1].length==='--root='.length)){
  console.error('Usage: node scripts/build.cjs [--check|--write] [--root=<test-directory>]');
  process.exit(2);
}
const root=args[1]?path.resolve(args[1].slice('--root='.length)):path.resolve(__dirname,'..');
const sourceDir=path.join(root,'src','legacy');
const artifact=path.join(root,'energiehuis-card.js');
// Fail closed on *any* unknown file, including .mjs/.cjs/.txt and hidden files.
let actual;
try{
 if(!fs.statSync(sourceDir).isDirectory())throw Error('Not a directory');
 actual=fs.readdirSync(sourceDir).sort();
}catch(error){
 console.error('Build aborted: missing or unreadable source directory: '+sourceDir);
 console.error('Hint: provide a repository root with src/legacy/, or restore the missing directory.');
 process.exit(1);
}
const expected=manifest.slice().sort();
if(JSON.stringify(actual)!==JSON.stringify(expected)){
 console.error('Build aborted: source fragment list differs from explicit manifest.');
 console.error('Expected: '+expected.join(', '));
 console.error('Found: '+actual.join(', '));
 console.error('Hint: restore the 16 known fragments; update the manifest only after an intentional source review.');
 process.exit(1);
}
for(const name of manifest){
 if(!fs.lstatSync(path.join(sourceDir,name)).isFile()){
  console.error('Build aborted: source fragment is not a regular file: '+name);
  process.exit(1);
 }
}
const output=Buffer.concat(manifest.map(name=>fs.readFileSync(path.join(sourceDir,name))));
const hash=crypto.createHash('sha256').update(output).digest('hex');
const previous=fs.existsSync(artifact)?fs.readFileSync(artifact):null;
function difference(expectedBytes,actualBytes){
 if(!actualBytes)return 'HACS artifact ontbreekt.';
 let at=0;
 while(at<expectedBytes.length&&at<actualBytes.length&&expectedBytes[at]===actualBytes[at])at++;
 const line=1+expectedBytes.subarray(0,at).reduce((n,b)=>n+(b===10?1:0),0);
 return 'Eerste byteverschil op offset '+at+', bronregel '+line+
  '; gebouwd: '+expectedBytes.length+' bytes, artefact: '+actualBytes.length+' bytes.';
}
if(mode==='--check'){
 if(!previous||!output.equals(previous)){
  console.error('FAIL: energiehuis-card.js is not byte-identical to the ordered src/legacy build.');
  console.error(difference(output,previous));
  console.error('Expected output SHA256: '+hash);
  console.error('Hint: inspecteer eerst handmatige wijzigingen en werk src/legacy/ bij.');
  console.error('Voer daarna bewust node scripts/build.cjs --write uit; dit vervangt alleen het gegenereerde HACS-bestand.');
  process.exit(1);
 }
 console.log('PASS: HACS bundle is byte-identical to src/legacy ('+output.length+' bytes; SHA256 '+hash+')');
}else{
 if(!previous||!output.equals(previous)){
  console.warn('NOTICE: --write vervangt energiehuis-card.js na een expliciete buildopdracht.');
  console.warn(difference(output,previous));
  // Atomic same-directory replacement. A failed write must leave the previous HACS file intact.
  const temp=artifact+'.tmp-'+process.pid+'-'+crypto.randomBytes(6).toString('hex');
  try{
   const modeBits=previous?fs.statSync(artifact).mode&0o777:0o644;
   fs.writeFileSync(temp,output,{flag:'wx',mode:modeBits});
   fs.renameSync(temp,artifact);
  }finally{
   if(fs.existsSync(temp))fs.unlinkSync(temp);
  }
  console.log('Updated HACS bundle ('+output.length+' bytes; SHA256 '+hash+')');
 }else{
  console.log('Unchanged HACS bundle ('+output.length+' bytes; SHA256 '+hash+')');
 }
}
