'use strict';
// Integration lock: preserve exact, independently reviewed PR #41 production artifact.
// SHA1 is Git's blob identity (header "blob <byte-size>\0", then raw bytes).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const built=fs.readFileSync(path.join(root,'energiehuis-card.js'));
const gitBlobSha=bytes=>crypto.createHash('sha1')
 .update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const expected='f92f4c03356e575f32d1fdb48fc89ee4893673ea';
const segments=[
 '00-foundation.js','01-history-analytics.js','02-card-shell.js',
 '03-energy-intelligence.js','04-utility-sources.js','05-energy-insights.js',
 '06-mobile-shell.js','07-script-charge-controls.js','08-battery-core.js',
 '09-battery-finance.js','10-battery-flow.js','11-data-quality.js',
 '12-battery-forecast-ui.js','13-contracts.js','14-detail-state.js',
 '15-homewizard-history.js'
];
test('PR41-integratie: HACS-bundle is exact de originele gereviewde PR41 Git-blob',()=>{
 assert.equal(gitBlobSha(built),expected,'Een byte verschil met PR41 blokkeert integratie');
 assert.equal(built.toString('utf8').includes('function eh24ChargeReading'),true);
 assert.equal(built.toString('utf8').includes('const EH_VERSION = \'1.24.1\';'),true,
  'Geen ongevraagde release/versiesprong; PR41 is nog een RC');
});
test('PR41-integratie: alle 16 modulaire bronsegmenten bouwen dezelfde PR41 Git-blob',()=>{
 const result=Buffer.concat(segments.map(name=>fs.readFileSync(path.join(root,'src','legacy',name))));
 assert.equal(gitBlobSha(result),expected);
 assert.equal(result.equals(built),true);
});
test('PR41-integratie: oorspronkelijke opt-in laadbediening en HACS-pad blijven intact',()=>{
 const text=built.toString('utf8');
 assert.match(text,/charge_control_enabled:\s*false/);
 assert.match(text,/if\(!customElements\.get\('energiehuis-card'\)\)customElements\.define/);
 const hacs=JSON.parse(fs.readFileSync(path.join(root,'hacs.json'),'utf8'));
 assert.equal(hacs.filename,'energiehuis-card.js');
});
