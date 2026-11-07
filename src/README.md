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
