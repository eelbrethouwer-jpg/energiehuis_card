# Energiehuis bronopdeling — PR 1 (buildnaad)

Dit is de **eerste, gedrag-neutrale architectuurstap** voor EnergieRegisseur v2.0. De bron is opgesplitst op bestaande top-level grenzen; er zijn geen rekenfuncties, opslagcodes, automatiseringen of events aangepast.

## Bouw / controleren

```sh
node scripts/build.cjs --check
node scripts/build.cjs --write
node --check energiehuis-card.js
node --test tests/*.test.cjs
```

`--check` is read-only en faalt als het geproduceerde bestand ook maar één byte afwijkt, met de eerste afwijkende byte en bronregel. `--write` meldt expliciet een overschrijving en vervangt uitsluitend `energiehuis-card.js` via een tijdelijk bestand en rename. Onbekende bestanden (ook `.mjs`, `.txt` of verborgen bestanden) in `src/legacy/` blokkeren de build. Geen npm-installatie of netwerk nodig.

## Bronindeling

- `src/legacy/00-foundation.js`: configuratie en basisfuncties
- `src/legacy/01-history-analytics.js`: historische analyses en grafiekhulpfuncties
- `src/legacy/02-card-shell.js`: bestaande custom element, render en CSS (intact)
- `src/legacy/03-energy-intelligence.js` tot `07-script-charge-controls.js`: legacy plugins, UI en bestaande opt-in laadbediening
- `src/legacy/08-battery-core.js` tot `12-battery-forecast-ui.js`: batterijreplay, grafieken, datakwaliteit en verwachtingen
- `src/legacy/13-contracts.js`: contractvergelijker en externe catalogus
- `src/legacy/14-detail-state.js`: herstel uitklapstatus
- `src/legacy/15-homewizard-history.js`: lokale CSV-import

**Belangrijke beperking:** dit zijn doelbewust *ordered source fragments*, nog geen zelfstandige ES-modules. Veel bestaande namen en `EnergiehuisCard.prototype`-uitbreidingen zijn globaal en volgordeafhankelijk. Een ESM-omzetting of engine-extractie nu zou gedrag veranderen. In PR 2 kunnen we gecontroleerd pure motoren uitlichten op basis van PR 0 fixtures.

De bestanden onder `src/legacy` moeten strikt in de volgorde uit `scripts/build.cjs` worden samengevoegd. Elke source-fragment bevat precies een continue byte-range uit de voor PR 1 bestaande `energiehuis-card.js`. Daardoor is de gebundelde kaart byte-identiek aan `main` v1.24.1 en blijft HACS het bestaande pad laden.

## Veiligheid / scope

- Alle bestaande opslagsleutels, Home Assistant-scripts, de 1×40 A / Alfen-configuratie, Modbus, EMS, de batterij- en contractmodellen en de `EH_VERSION` blijven ongemoeid.
- Geen `shell: v2` geactiveerd en geen aanvullende HA-schrijfacties.
- Legacy-definities zijn niet geïmporteerd als ESM; de huidige klassikale prototype-keten blijft exact dezelfde.
- Geen release of merge van PR 1 zonder afzonderlijke review.
- PR #41 blijft apart en is geen prerequisiet voor deze buildnaad.

## Integratie bij latere PR #41

Bij een eventuele merge van PR #41 zal het HACS-bestand veranderen, maar de PR1-bronfragmenten nog niet. De `--check` hoort dan bewust te **falen**. Verwerk die wijziging eerst in de juiste `src/legacy/`-bronsegmenten en genereer de bundel opnieuw. Dit is gewenst fail-closed gedrag, geen regressie.

## Open voor opvolgende PR's

- Publicatieworkflows expliciet van `node scripts/build.cjs --check` voorzien (voorlopig alleen de algemene validate- en browser-workflow + Node-pariteitstest in CI).
- Het vaste `EH_VERSION`-criterium in `tests/v2-build-parity.test.cjs` aanpassen wanneer PR #41 later een versieverhoging doorvoert; niet stilzwijgend loslaten.
- America/New_York heeft drie bestaande testproblemen op `main`; deze staan los van de PR1-bronopdeling.

## PR 2 — Extractie batterijmotor (in ontwikkeling)

`src/engines/battery-engine.cjs` is de los importeerbare, zuivere rekenmotor (Node `require`), zonder Home Assistant, DOM of opslag. In de HACS classic-script wordt deze bron **zonder wrapper/transformatie** tussen `src/legacy/08-battery-core.js` en `08-battery-chart.js` ingevoegd. De functies behouden exact hun globale namen. `eh17N` is in deze module vervangen door een identieke lokale numerieke parser, zodat de import geen dashboardafhankelijkheid heeft. Verificatie: golden snapshots vóór extractie, realtime vergelijking met de gebundelde kaart, browserregressies en CI buildpariteit.

De historische PR41-blob was vóór deze refactor exact gecontroleerd; na extractie blijft die hash alleen gedocumenteerd. De vaste volledige-file SHA-test is bewust vervangen door reproduceerbare build/gedragschecks. PR2 wijzigt nog geen fysieke batterijlogica of runtime-scriptacties.

### Claude-review B1–B5 — veilige wijzigingen voor merge

- B1: build valideert de volledige samengestelde JavaScript-syntax vóór controle of schrijven (`vm.Script`), en weigert ongeldige bundels zonder bestaand artefact te overschrijven.
- B2: standalone module gebruikt `Object.assign(module.exports, {...})` om oudere host-exports in eventuele bundlercontexten te behouden; gewone Node-import blijft gelijk.
- B3: parser-gelijkenis met de legacy `eh17N` wordt differentieel getest op ruim vijftig invoertypen, grenswaarden en uitzonderingen.
- B4: vijf extra, vóór-extractie tegen baseline `ee17c887` doorgerekende characterization snapshots voor volle accu, 25-uursperiode, 1,1-uurcap, gelijktijdig import/export en negatieve prijs; fysieke modelkwaliteit blijft een apart onderwerp.
- B5: het buildplan benoemt expliciet de volgorde input → engine → grafiek. Bestandsnamen behouden om bestaande integraties en herkenbaarheid niet onnodig te verstoren.

**Geen nieuwe versie of publicatie.** Bestaande UI, historische opslagkeys en laadbediening ongemoeid.

## PR 3 — Tweede pure rekenmotor: P1-meetkwaliteit

- `eh30PersonalEvidence` is exact uit `src/legacy/09-battery-finance.js` gehaald en staat in `src/engines/personal-evidence-engine.cjs`. De oorspronkelijke HTML-rendering en alle openbare functies blijven beschikbaar in de HACS classic-script-bundel.
- De 13 goldens in `tests/v2/fixtures/personal-evidence-v1241.json` zijn vóór extractie berekend met ongewijzigde main `c22eabd4310288136d08d60c1f46258fa6e58102`; source blob `abf33ba2748bfa2db6e059ef9a0a8fd4b490f8ee`. Het zijn geobserveerde uitkomsten, geen compleetheidscertificaat voor P1-data.
- `buildSteps` geeft per engine expliciet de positie aan. Alle verwachte engine-bestanden moeten exact aanwezig zijn; extra bestanden, ontbrekende bestanden of symlinks blokkeren de build.
- Elke engine wordt nu afzonderlijk als CommonJS in een `vm.Script` geparseerd, **en** daarna wordt de volledig gecombineerde HACS-bundel geparseerd. De build voert de engines niet uit en vervangt het HACS-bestand pas nadat de controles zijn geslaagd.
- Extra regressies controleren standalone/embedded/golden-pariteit, niet-muteren van invoer, bevroren hostexports, gemaskeerde syntaxfouten over fragmentgrenzen en atomair bouwen.
- Veiligheidsgrens: geen wijzigingen aan Home Assistant-commando's, localStorage, Alfen, P1-meetbron, stroomprijzen, laadadviseur of batterijmodel. `EH_VERSION`, `hacs.json` en de vrijgegeven versie blijven ongewijzigd. PR 3 blijft een draft tot externe review en gebruikersakkoord; geen release.
