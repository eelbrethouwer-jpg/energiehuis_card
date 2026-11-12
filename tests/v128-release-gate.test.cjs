'use strict';
// Release gate for Energiehuis v1.28.0 Immersive Home.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const foundation=read('src/legacy/00-foundation.js'),shell=read('src/legacy/02-card-shell.js');
const bundle=read('energiehuis-card.js'),notes=read('RELEASE_NOTES_v1.28.0.md');
const workflow=read('.github/workflows/publish-v1280.yml');

test('current release: version, Lovelace catalogue, generated HACS bundle and immersive routing match',()=>{
 for(const s of [foundation,bundle])assert.match(s,/const EH_VERSION = '1\.29\.0';/);
 for(const s of [shell,bundle])assert.match(s,/name:'Energiehuis v1\.29\.0'/);
 assert.match(bundle,/const EH_IMM_ROUTES/);
 assert.match(bundle,/live_cockpit_immersive/);
 assert.match(bundle,/function eh40Cockpit\(/);
 assert.match(bundle,/function createController\(card, cfg\)/);
});
test('v1.28.0: release can only be published manually after validated main and exact approval',()=>{
 assert.match(workflow,/^on:\s*\n\s+workflow_dispatch:/m);
 assert.doesNotMatch(workflow,/^\s{2}(?:push|pull_request|schedule|release):/m);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/inputs\.confirmation == 'PUBLISH_v1\.28\.0'/);
 assert.match(workflow,/needs: validate/);
 assert.match(workflow,/git ls-remote --tags origin refs\/tags\/v1\.28\.0/);
 assert.match(workflow,/gh release create v1\.28\.0 --target "\$GITHUB_SHA"/);
});
test('v1.28.0: build, UTC/Amsterdam, existing browser suites, Chromium+WebKit immersive',()=>{
 for(const line of [
   'node scripts/build.cjs --check','node --check energiehuis-card.js',
   'TZ=UTC node --test tests/*.test.cjs',
   'TZ=Europe/Amsterdam node --test tests/*.test.cjs',
   'node tests/browser/live-cockpit-home.cjs',
   'node tests/browser/live-cockpit-home.cjs --browser=webkit',
   'node tests/browser/live-cockpit-immersive.cjs',
   'node tests/browser/live-cockpit-immersive.cjs --browser=webkit'
 ])assert.ok(workflow.includes(line),line);
 for(const phrase of ['live_cockpit_immersive: true','netPresentation()','1×40 A','v1.28.0','VoiceOver','geen'])assert.ok(notes.includes(phrase),phrase);
});
