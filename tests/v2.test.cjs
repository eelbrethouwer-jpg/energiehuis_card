'use strict';
// Bridge for existing CI: node --test tests/*.test.cjs does not match tests/v2/*.test.cjs.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const dir=path.join(__dirname,'v2');
const files=fs.readdirSync(dir).filter(name=>name.endsWith('.test.cjs')).sort();
assert.ok(files.length>=4,'Expected all v2 test modules in the top-level CI loader');
for(const name of files)require(path.join(dir,name));
