'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('PR0 CI: nested v2 test modules are loaded by the existing top-level glob',()=>{
 const loader=fs.readFileSync(path.join(__dirname,'..','v2.test.cjs'),'utf8');
 const names=fs.readdirSync(__dirname).filter(n=>n.endsWith('.test.cjs')).sort();
 assert.deepEqual(names,["counterexamples.test.cjs","dst.test.cjs","legacy-characterization.test.cjs","loader-smoke.test.cjs","normative.test.cjs"]);assert.match(loader,/deepEqual\(files,expected/);assert.match(loader,/require\(path\.join\(dir,name\)\)/);
});
test('PR0 CI: failure-propagation probe (opt-in, never active in normal CI)',()=>{
 if(process.env.EH_V2_TEST_FAIL_PROBE==='1')assert.fail('Intentional PR0 negative-control failure');
 assert.equal(1+1,2);
});
