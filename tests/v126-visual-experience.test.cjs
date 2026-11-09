'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fragment=read('src/legacy/16-regisseur-cockpit.js');
const bundle=read('energiehuis-card.js');
const note=read('RELEASE_NOTES_v1.26.0_RC.md');
const addition=fragment.split('/* v1.26.0-rc Visual Experience:')[1];

test('v1.26 RC: JS parses and built bundle ends with identical source fragment',()=>{
 assert.ok(addition,'Visual Experience must be in last source fragment');
 assert.ok(bundle.endsWith(fragment),'Generated HACS resource must contain identical final fragment');
 assert.doesNotThrow(()=>new vm.Script(bundle));
});
test('v1.26 RC: four navigation destinations and preserved insight pages',()=>{
 for(const label of ['Home','Laden','Inzicht','Meer'])assert.ok(addition.includes("'"+label+"'"));
 for(const page of ['cupra','battery','costs'])assert.ok(addition.includes('data-eh-page="'+page+'"'));
 assert.match(addition,/eh26Navigation/);
 assert.match(addition,/aria-expanded/);
 assert.match(addition,/Escape/);
});
test('v1.26 RC: legacy meter controls remain discoverable and stateful',()=>{
 assert.match(addition,/Alle metingen en uitgebreide grafiek/);
 assert.match(addition,/eh26LegacyOpen/);
 assert.match(bundle,/metric-grid/);
 assert.match(bundle,/data-eh-detail/);
 assert.match(bundle,/function eh40Cockpit/);
});
test('v1.26 RC: no new HA writes, storage or charging logic',()=>{
 assert.doesNotMatch(addition,/callService|localStorage|sessionStorage|sendMessage|charge_control_enabled/);
 assert.match(note,/PR #50 is gemerged in `main`/);
 assert.match(note,/NIET TAGGEN OF PUBLICEREN/);
 assert.match(note,/nog geen definitieve versie-update, tag, release of HACS-publicatie/);
 assert.match(note,/geen nieuwe Home Assistant-servicecalls/i);
 assert.match(bundle,/const EH_VERSION = '1\.25\.0'/);
});
