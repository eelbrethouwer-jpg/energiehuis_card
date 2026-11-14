'use strict';
// Release gate for Energiehuis v1.30.0 Praktijkruimte.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const foundation=read('src/legacy/00-foundation.js'),shell=read('src/legacy/02-card-shell.js');
const bundle=read('energiehuis-card.js'),notes=read('RELEASE_NOTES_v1.30.0.md');
const workflow=read('.github/workflows/publish-v1300.yml');
test('v1.30.0: versie in source, HACS-bundel en catalogus gelijk',()=>{
 for(const s of [foundation,bundle])assert.match(s,/const EH_VERSION = '1\.30\.0';/);
 for(const s of [shell,bundle])assert.match(s,/name:'Energiehuis v1\.30\.0'/);
 assert.match(bundle,/function ehImmPracticeCompute\(/);
 assert.match(bundle,/function ehImmPracticeChart\(/);
});
test('v1.30.0: publicatie uitsluitend handmatig vanaf main, validatie voor tag',()=>{
 assert.match(workflow,/^on:\s*\n\s+workflow_dispatch:/m);
 assert.doesNotMatch(workflow,/^\s{2}(?:push|pull_request|schedule|release):/m);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/inputs\.confirmation == 'PUBLISH_v1\.30\.0'/);
 assert.match(workflow,/needs: validate/);
 assert.match(workflow,/git ls-remote --tags origin refs\/tags\/v1\.30\.0/);
 assert.match(workflow,/gh release create v1\.30\.0 --target "\$GITHUB_SHA"/);
});
test('v1.30.0: UTC, Amsterdam en Chromium/WebKit blijven verplichte controles',()=>{
 for(const cmd of ['node scripts/build.cjs --check','node --check energiehuis-card.js','TZ=UTC node --test tests/*.test.cjs',
 'TZ=Europe/Amsterdam node --test tests/*.test.cjs','node tests/browser/live-cockpit-immersive.cjs','node tests/browser/live-cockpit-immersive.cjs --browser=webkit'])
 assert.ok(workflow.includes(cmd),cmd);
 for(const txt of ['v1.30.0','praktijk: sensor.praktijkruimte_kwh_meter_vermogen','praktijk_energie: sensor.praktijkruimte_kwh_meter_energie_import','indicatief','Alfen'])assert.ok(notes.includes(txt),txt);
});
