# Energiehuis Live Cockpit — PVE-01 | Premium Visual Experience

**8 november 2026 · geïsoleerde visuele implementatie / designdemo**

## Technische uitgangssituatie

- Repository: `eelbrethouwer-jpg/energiehuis_card`.
- Gecontroleerde remote `main` op 2026-11-08: `7308d3a72de5073f398f26041404d0e400785d0a`.
- Laatste bekende lokale standalone startscherm-preview: `Energiehuis_Live_Cockpit_Startscherm_DEMO.html`, behorend bij de lokale UX-kandidaat op Git-tree `2767c998d188ad576ee5ed00741ec670227eb823`.
- PVE-01 wijzigt geen enkel GitHub-bestand, Home Assistant-bestand of lokale HACS-resource.
- Dit is **geen** pull request, releasekandidaat voor productie of geverifieerde HA-integratie.

## Kritische beoordeling

De vorige standalone preview bevatte reeds de goede onderdelen, maar was visueel te schematisch: een vereenvoudigd huis op een plat raster, vlakke UI-kaarten en een minder overtuigende energiescène. In het oorspronkelijke goedgekeurde concept zijn objecten veel rijker gerenderd en komen meer diepte, licht, sfeer en visuele hiërarchie voor.

PVE-01 introduceert een eigen scène, donkere zonsondergang, een 2.5D illustratie van een huis, gelaagde verlichting, soft shadows, een groen uitgewerkte Cupra, translucente kaarten en bewegende stroomdeeltjes. **De illustraties zijn nog handgetekende SVG/gradient-assets en niet het beoogde uiteindelijke fotorealistische renderpakket**. Dit is een bewuste onafhankelijke visuele pilot.

## Indeling

- Zonnepanelen linksboven.
- Virtuele batterij rechtsboven, altijd expliciet **simulatie; geen fysieke opslag**. Gestippelde paarse decoratieve indicatie, nooit als fysieke geverifieerde flow.
- Huis als middenobject, met huisverbruik exclusief EV.
- Net midden onder het huis; wisselt tussen import (+) en teruglevering (−).
- Praktijkruimte linksonder: **— kW / Nog niet gekoppeld**. Geen gefingeerde waarde, geen actieve route en niet automatisch opgeteld bij totale vraag.
- Knalgroene Cupra rechts onder, met EV-laadvermogen.
- Desktop en mobiel gebruiken eigen flow-svg-padcoördinaten voor heldere routes.

## Veiligheidsgrenzen

De HTML is een **losse, optisch geanimeerde demonstratie met synthetische waarden**. Er is geen integratie met Home Assistant of externe netwerkbron, geen storage, HA-servicecalls of laadbesturing. De datascenario's hebben rekenkundig consistente balansen (PV + P1 = huis + EV), maar die scenario's bewijzen vanzelfsprekend niets over een fysieke aansluiting. Alle daadwerkelijke fysieke meetketenflags blijven buiten scope en worden niet actief gemaakt. In productie blijven animaties afhankelijk van de bestaande fail-closed modelveiligheid, zodra die onafhankelijk is geverifieerd.

## Runnen

Open `energiehuis_live_cockpit_premium_preview.html` in een moderne browser; dit is een zelfstandige HTML-pagina zonder build, externe dependency of netwerkverbinding. Gebruik de knoppen *Zon & teruglevering*, *Netafname & laden*, *Nacht* en *Offline* om gedrag te vergelijken. Klik op een energiecomponent om de betekenis te zien.

**Niet** uploaden als Lovelace-resource, niet kopiëren over `energiehuis-card.js`, niet gebruiken als bron van echte stroomstanden.

## Tests (daadwerkelijk uitgevoerd)

- `node energiehuis_premium_preview_tests.cjs` PASS: JS syntaxis, demo-balans, import/exportrichting, PV-, EV- en offline-scenario's, praktijkruimte zonder flow, virtuele batterij, read-only-invarianten, scenario-controls en details.
- Chromium/Python Playwright `page.set_content()` op 320/390/768/1440 px: geen horizontale scrolloverflow, geen overlappende buitenkaarten, geen JS runtime fouten; actieve scenario-omschakeling import/offline PASS.
- `prefers-reduced-motion: reduce`: `animationName: none` gecontroleerd.
- Schermafbeeldingen van desktop 1440 en mobiel 390 opgeslagen en visueel geïnspecteerd.

**Niet getest:** WebKit/Safari, echte iPhone, schermlezers, 200% dynamische iOS-tekst, Home Assistant live entiteiten, 24h suspend, fysieke meetketen, integratie met bestaande `src/live-cockpit` of GitHub CI. Browsercheck is geen formele regressiesuite tegen productie.

## Uitvoeringsadvies (PVE-02)

1. Maak een nieuw, afzonderlijk realistisch 2.5D assetpakket op basis van het goedgekeurde concept: huis (dag/avond), PV-panelen, groene Cupra, praktijkruimte. Gebruik geoptimaliseerde AVIF/WebP-lagen met vaste ankerpunten; fallback SVG behouden.
2. Integreer enkel de `SceneRenderer`/`FlowOverlay` en tokens in de geïsoleerde `src/live-cockpit/card.js`, niet in `src/legacy/` of `energiehuis-card.js`.
3. Contract tussen model en visualisatie: `reading(value, unit, fresh, source)`, `verifiedFlows(routes)`, `simulation`, `offline`; fysieke animaties uitsluitend op `verifiedFlows`.
4. Test op 320/390/768/1440, 200% tekst, reduced motion, offline, nul- en verouderde waarden, meerdere instanties, keyboard/escape/focus en long-suspend. Render visuele screenshots; vergelijk met het goedgekeurde concept.
5. Laat onafhankelijke review uitvoeren op exacte lokale bron/HEAD. Geen push, PR, merge, tag, release, HACS of fysieke flags.