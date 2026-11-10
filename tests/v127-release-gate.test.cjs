'use strict';
// Release gate for opt-in Premium Live Cockpit, independent of historical v1.25.0.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const foundation=read('src/legacy/00-foundation.js');
const shell=read('src/legacy/02-card-shell.js');
const bundle=read('energiehuis-card.js');
const workflow=read('.github/workflows/publish-v1270.yml');
const notes=read('RELEASE_NOTES_v1.27.0.md');

test('v1.27.0: source, HACS bundle and card catalogue are consistent',()=>{
 for(const s of [foundation,bundle])assert.match(s,/const EH_VERSION = '1\.27\.0';/);
 for(const s of [shell,bundle])assert.match(s,/name:'Energiehuis v1\.27\.0'/);
 assert.match(bundle,/function eh40Cockpit\(/);
 assert.match(bundle,/function createController\(card, cfg\)/);
 assert.match(bundle,/live_cockpit === true/);
});
test('v1.27.0: release workflow manual on main with an explicit confirmation; no auto-publish',()=>{
 assert.match(workflow,/^on:\s*\n\s+workflow_dispatch:/m);
 assert.doesNotMatch(workflow,/^\s{2}(?:push|pull_request|schedule|release):/m);
 assert.match(workflow,/inputs\.confirmation == 'PUBLISH_v1\.27\.0'/);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/needs: validate/);
 assert.match(workflow,/git ls-remote --tags origin refs\/tags\/v1\.27\.0/);
 assert.match(workflow,/gh release create v1\.27\.0 --target "\$GITHUB_SHA"/);
});
test('v1.27.0: build, two TZs, Chromium and WebKit Live Cockpit must pass before publish',()=>{
 for(const s of [
   'node scripts/build.cjs --check',
   'TZ=UTC node --test tests/*.test.cjs',
   'TZ=Europe/Amsterdam node --test tests/*.test.cjs',
   'node tests/browser/regisseur-cockpit.cjs',
   'node tests/browser/live-cockpit-home.cjs',
   'node tests/browser/live-cockpit-home.cjs --browser=webkit'
 ])assert.ok(workflow.includes(s),s);
 assert.match(notes,/live_cockpit: true/);
 assert.match(notes,/last_reported/);
 assert.match(notes,/1×40 A/);
 assert.match(notes,/v1\.27\.0/);
});
