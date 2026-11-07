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
const actual=fs.readdirSync(sourceDir).filter(name=>name.endsWith('.js')).sort();
const expected=manifest.slice().sort();
if(JSON.stringify(actual)!==JSON.stringify(expected)){
  console.error('Build aborted: source fragment list differs from explicit manifest.');
  console.error('Expected: '+expected.join(', '));
  console.error('Found: '+actual.join(', '));
  process.exit(1);
}
const output=Buffer.concat(manifest.map(name=>fs.readFileSync(path.join(sourceDir,name))));
const hash=crypto.createHash('sha256').update(output).digest('hex');
const previous=fs.existsSync(artifact)?fs.readFileSync(artifact):null;
if(mode==='--check'){
  if(!previous||!output.equals(previous)){
    console.error('FAIL: energiehuis-card.js is not byte-identical to the ordered src/legacy build.');
    console.error('Expected output SHA256: '+hash);
    process.exit(1);
  }
  console.log('PASS: HACS bundle is byte-identical to src/legacy ('+output.length+' bytes; SHA256 '+hash+')');
}else{
  if(!previous||!output.equals(previous)){
    fs.writeFileSync(artifact,output);
    console.log('Updated HACS bundle ('+output.length+' bytes; SHA256 '+hash+')');
  }else{
    console.log('Unchanged HACS bundle ('+output.length+' bytes; SHA256 '+hash+')');
  }
}
