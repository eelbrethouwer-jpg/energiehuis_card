'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');

test('v1.13.2-rc.1 heeft correct intern versielabel',()=>{
 assert.match(source,/const EH_VERSION = '1\.13\.2-rc\.1';/);
 assert.doesNotMatch(source,/const EH_VERSION = '1\.13\.0-rc\.2';/);
});

test('snelle contractopslag blijft gekoppeld aan persistente browseropslag',()=>{
 assert.match(source,/case 'save-selected':/);
 assert.match(source,/this\._ehcmpSave\(\[\.\.\./);
 assert.match(source,/storage\.setItem\(EH_COMPARE_STORAGE/);
 assert.match(source,/storage\.getItem\(EH_COMPARE_STORAGE/);
});
