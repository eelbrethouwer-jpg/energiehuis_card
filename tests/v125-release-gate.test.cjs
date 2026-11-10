'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const workflow=read('.github/workflows/publish-v1250.yml');
const foundation=read('src/legacy/00-foundation.js');
const shell=read('src/legacy/02-card-shell.js');
const bundle=read('energiehuis-card.js');
const notes=read('RELEASE_NOTES_v1.25.0.md');

test('v1.25.0 historical publish workflow remains pinned to its published release',()=>{
 assert.ok(workflow.includes("const EH_VERSION = '1.25.0';"));
 assert.ok(workflow.includes("name:'Energiehuis v1.25.0'"));
 assert.match(notes,/Energiehuis v1\.25\.0/);
 assert.match(bundle,/function eh40Cockpit\(/);
});

test('v1.25.0 release prep: no automatic tag or release after merge',()=>{
 assert.match(workflow,/^on:\s*\n\s+workflow_dispatch:/m);
 assert.doesNotMatch(workflow,/^\s{2}(?:push|pull_request|schedule|release):/m);
 assert.match(workflow,/inputs\.confirmation == 'PUBLISH_v1\.25\.0'/);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/needs: validate/);
 assert.match(workflow,/test -n "\$\(git ls-remote --tags origin refs\/tags\/v1\.25\.0\)"/);
 assert.match(workflow,/gh release create v1\.25\.0 --target "\$GITHUB_SHA"/);
});
test('v1.25.0 release prep: required compatibility, validation and live warnings',()=>{
 assert.match(workflow,/node scripts\/build\.cjs --check/);
 assert.match(workflow,/TZ=UTC node --test tests\/\*\.test\.cjs/);
 assert.match(workflow,/TZ=Europe\/Amsterdam node --test tests\/\*\.test\.cjs/);
 assert.match(workflow,/node tests\/browser\/regisseur-cockpit\.cjs/);
 assert.match(notes,/last_reported/);
 assert.match(notes,/fysieke iPhone/);
 assert.match(notes,/Alfen Active Load Balancing/);
 assert.match(notes,/v1\.25\.0/);
});
