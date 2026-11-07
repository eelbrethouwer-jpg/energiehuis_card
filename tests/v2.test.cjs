'use strict';
// Bridge for existing CI: node --test tests/*.test.cjs does not match tests/v2/*.test.cjs.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const dir=path.join(__dirname,'v2');
const files=fs.readdirSync(dir).filter(name=>name.endsWith('.test.cjs')).sort();
const expected=["counterexamples.test.cjs","dst.test.cjs","legacy-characterization.test.cjs","loader-smoke.test.cjs","normative.test.cjs"];
assert.deepEqual(files,expected,'Declare every added/removed v2 test module in the explicit CI manifest');
// Export once before loading nested files: their smoke test can share this exact manifest.
module.exports={expected};
for(const name of files)require(path.join(dir,name));
