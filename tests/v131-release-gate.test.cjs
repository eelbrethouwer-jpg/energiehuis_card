'use strict';
// v1.31.0 release gate: version consistency, safe manual publication and thermostat contract.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const foundation=read('src/legacy/00-foundation.js'),shell=read('src/legacy/02-card-shell.js'),bundle=read('energiehuis-card.js');
const workflow=read('.github/workflows/publish-v1310.yml'),notes=read('RELEASE_NOTES_v1.31.0.md');
test('v1.31.0: bron, HACS-bundel en Lovelace-naam consistent',()=>{
 for(const s of [foundation,bundle])assert.match(s,/const EH_VERSION = '1\.31\.0';/);
 for(const s of [shell,bundle])assert.match(s,/name:'Energiehuis v1\.31\.0'/);
 assert.match(bundle,/function ehImmThermostat\(/);
 assert.match(bundle,/P\._ehImmThermoAdjust=async function\(/);
});
test('v1.31.0: release alleen na handmatige main-validatie met bevestigingscode',()=>{
 assert.match(workflow,/^on:\s*\n\s+workflow_dispatch:/m);
 assert.doesNotMatch(workflow,/^\s{2}(?:push|pull_request|schedule|release):/m);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/inputs\.confirmation == 'PUBLISH_v1\.31\.0'/);
 assert.match(workflow,/needs: validate/);
 assert.ok(workflow.includes(`grep -Fq "const EH_VERSION = '1.31.0';" energiehuis-card.js`),'release must validate its own version');
 assert.ok(!workflow.includes(`grep -Fq "const EH_VERSION = '1.30.0';" energiehuis-card.js`),'release must never expect prior version');
 assert.match(workflow,/git ls-remote --tags origin refs\/tags\/v1\.31\.0/);
 assert.match(workflow,/gh release create v1\.31\.0 --target "\$GITHUB_SHA"/);
});
test('v1.31.0: regressies + expliciete thermostaatopt-in beschreven',()=>{
 for(const cmd of [
 'node scripts/build.cjs --check','node --check energiehuis-card.js',
 'TZ=UTC node --test tests/*.test.cjs','TZ=Europe/Amsterdam node --test tests/*.test.cjs',
 'node tests/browser/live-cockpit-immersive.cjs','node tests/browser/live-cockpit-immersive.cjs --browser=webkit',
 "grep -Fq 'function ehImmThermostat('"
 ])assert.ok(workflow.includes(cmd),cmd);
 for(const s of ['v1.31.0','thermostaat: climate.wgw_ot_on_off','PUBLISH_v1.31.0','Alfen','geen automatische','klokprogramma'])assert.ok(notes.toLowerCase().includes(s.toLowerCase()),s);
});
