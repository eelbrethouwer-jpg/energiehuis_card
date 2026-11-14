# PROJECT_STATUS — Energiehuis

## Open feature — 14 november 2026 · PR #65 (draft)

- **Gebouwd:** praktijkruimte-submeter met echte live W, kWh- en dynamische maandkostenindicatie, daggrafiek; branch `feature/praktijkruimte-live-maandkosten`, basis main `c0d14378986c1de7477e303e3ed9e29e7fe723d0`.
- **Automatisch getest:** op feature-HEAD `6869be5fdfa2bd2d973b529abc979040622b78a8` zijn v1.7 Node-matrix, HACS-check en multi-supplier-regressie groen. Browsercheck loopt; nieuwe praktijkruimte-browsertest moet op de opvolgende HEAD worden gecontroleerd.
- **Praktisch getest:** nee; eigen HA, iPhone, historische prijsdekking en 1×40A-installatie nog niet gecontroleerd.
- **Gepubliceerd:** nee. Main en HACS v1.29.0 blijven ongewijzigd. Geen merge, tag of release zonder apart akkoord.
- **Actie voor gebruik na release:** vul `praktijk` en `praktijk_energie` in de Lovelace-kaartconfiguratie in. De nieuwe kaart rekent praktijkverbruik niet dubbel bij Huis.

---

## Actuele status — 12 november 2026

- Geïntegreerde features: PR #58–#61 via PR #61, mergecommit `3af12c943c16db7e51ca6fdffe82aa356d4aa709`.
- Releasevoorbereiding: PR #62, HEAD `03bbf9495db1e4611bca5f3a2d5f6f24646ef262`, main-mergecommit `f97c8f03b66b8427e3ed784109e194f2f151a6ea`.
- Gebouwd: ja, standaard HACS-bundel met interne versie en kaartkiezernaam v1.29.0. Geen preview/testregistratie opgenomen in productie.
- Automatisch getest: release-inhoud lokaal 420/420 Node-tests in UTC en Europe/Amsterdam; alle vijf CI-jobs op release-HEAD groen, inclusief de bestaande browserregressies, immersive Chromium/WebKit en screenshotcontrole. De handmatige publicatierun heeft dezelfde main-mergecommit opnieuw volledig gevalideerd, inclusief Chromium/WebKit, vóór tag/release. In de aparte automatische main-run werd bij één WebKit-lifecyclecontrole de pagina/browser gesloten (47/48); dezelfde volledige suite slaagde in de release-PR en publicatierun. Alleen de mislukte main-browserjob is opnieuw gestart, zonder codewijzigingen; zie [de run](https://github.com/eelbrethouwer-jpg/energiehuis_card/actions/runs/43303747268).
- Praktisch getest: eigenaar beoordeelde de code-equivalente testvariant positief in eigen HA/iPhone en meldde dat het flikkeren verdwenen lijkt. Geen volledige fysieke acceptatie geclaimd; model/iOS/VoiceOver en niet-observeerbare laadpauzes zijn niet volledig vastgelegd.
- Gepubliceerd: ja: [v1.29.0](https://github.com/eelbrethouwer-jpg/energiehuis_card/releases/tag/v1.29.0), gepubliceerd op 12 november 2026 om 21:54 CET. Tag verwijst naar `f97c8f03b66b8427e3ed784109e194f2f151a6ea`. De [handmatige publicatierun](https://github.com/eelbrethouwer-jpg/energiehuis_card/actions/runs/43303763456) is volledig geslaagd, inclusief validate en publish.
- Toestemming: eigenaar heeft expliciet gevraagd de wijziging live te zetten; merge en release zijn binnen die opdracht uitgevoerd.
- Nieuwe weergave: landscape Home, stabiele meetupdates, conservatieve sessietotalen, morgenprijzen en optionele alleen-lezen HA-laadplanning volgens de aangeleverde ApexCharts-YAML.
- Geen nieuwe HA-servicecalls, opslagkeys, entiteitsmigraties of wijzigingen aan Alfen-bediening, 1×40 A en Active Load Balancing.

Na HACS-update: normale resource en `type: custom:energiehuis-card` gebruiken. Bestaande sensoren en beveiligde Media Source-afbeelding behouden. Optioneel `live_cockpit_immersive: true`, `live_cockpit_planning: true` en expliciete `kwartier_forecast` uit de eigen installatie. Planning is geen bevestiging van daadwerkelijk laden. Bij schaarse historie kan de sessie niet beschikbaar blijven. De aparte `/local/eh-pr59.js` en `custom:energiehuis-card-pr59-test` zijn uitsluitend testvarianten. Terugval via HACS v1.28.0 of de immersive-optie uitzetten.

---

## Historische status — 10 november 2026

Deze status verwijst naar de geverifieerde **featuremerge** `main` `86c92ceb2ea619466f107d13c2fe630af4373709` (PR #56) en de gepubliceerde release v1.27.0. De afzonderlijke v1.28-release-PR moet zijn eigen CI nog doorlopen.

| Onderdeel | Status |
|---|---|
| Feature op main | **PR #56 gemerged**: Immersive Live Cockpit Home, mergecommit `86c92ceb2ea619466f107d13c2fe630af4373709`. |
| Eigenaar / visuele acceptatie | Visuele acceptatie bevestigd op code-HEAD `457876c11fa9684a36eedaf73cf24e626a58b380`. Toestemming voor merge en release afzonderlijk gegeven op 10 november 2026, vastgelegd in PR-comment #56. |
| Gebouwd | Immersive Home achter `live_cockpit_immersive: true` (alleen met `live_cockpit: true`), zes klikroutes, portretcompositie, neutrale Net-presentatie, eigen detailpagina's. Bestaande functies/entiteiten/bediening behouden. |
| Automatisch getest | PR #56 definitieve HEAD `96e05f12abd3ce5d80222bda14d9feeb0efc4726`: **5/5 GitHub checks groen** (Node, frontend twee TZ, Chromium/WebKit, validate). Release-HEAD v1.28.0 opnieuw testen. |
| Laatste gepubliceerde versie | **v1.27.0** (GitHub-release 10 november 2026). De nieuwe v1.28.0 is **nog niet gepubliceerd**, ook als de releasecode op een branch staat. |
| Versievoorbereiding | Aparte branch `release/energiehuis-v1.28.0-immersive`; EH_VERSION, Lovelace-catalogus, gegenereerde bundel, release notes en handmatige workflow `publish-v1280.yml`. |
| Praktisch getest | De bestaande v1.27.0 Live Cockpit werkte zichtbaar in de eigen HA/iPhone. **Nieuwe Immersive Home v1.28.0 nog NIET fysiek getest** (safe-area, VoiceOver, reële meetketen/Alfen en Media Source). |
| Veiligheid | Nieuwe cockpit alleen lezen. Geen nieuwe HA-servicecalls, wijziging van opslag, laadbediening, entiteiten, 1×40 A of Active Load Balancing. |

**AGENTS.md §7:** gebouwd = **ja (main)**; automatisch getest = **ja voor de feature-HEAD**; praktisch getest = **nee voor v1.28.0**; gepubliceerd = **nee voor v1.28.0**.

**Vervolg:** Release-PR valideren en na groen CI mergen. De v1.28.0-publicatie blijft een afzonderlijke `workflow_dispatch` op `main` met code `PUBLISH_v1.28.0` en volledige tests. Geen automatische release op merge. Praktische Home Assistant-test daarna met `live_cockpit_immersive: true`; bij problemen direct uitzetten en terug naar v1.27.0-Home.

---

## Historische statusinformatie (niet actueel)

> De onderstaande blokken zijn **historische momentopnamen** en beschrijven niet de huidige status. Gebruik voor de actuele status uitsluitend het blok hierboven en GitHub.

> **29 oktober 2026 — v1.13.0-rc.2:** na merge van PR #19 gebouwd op main `3c0d653aa756e3457faa3527fd5c7e7588298fec`. Branch `feature/aanbiederstarieven`: aparte aanbiederslijst, bron-/controledatum en conceptbevestiging, prijscomponenten, dynamische teruglevercorrectie en maandkosten. 108 tests + lokale Chromium-test met fictieve tarieven groen. Live raw-GitHub-fetch + browsertoegang en schema met 42 aanbiedingen in GitHub CI geslaagd; HACS en regressies groen. [Draft-PR #20](https://github.com/eelbrethouwer-jpg/energiehuis_card/pull/20). Geen EnergyZero-marktprijsintegratie; eigen kale beursprijssensor vereist voor dynamische lijstcontracten. HA/iPhone-praktijkacceptatie open. Zie [RC2-notes](RELEASE_NOTES_v1.13.0_RC2.md). Geen release of installatie uitgevoerd.

> **29 oktober 2026 — v1.13.0-rc.1:** afzonderlijke stroomvergelijker gebouwd op actuele main `3596cf4a047559d5cece01f1b71ba901799b13f0` (codeversie 1.12.1). Branch `feature/stroomvergelijker`, [draft-PR #19](https://github.com/eelbrethouwer-jpg/energiehuis_card/pull/19). Bestaande Vattenfall-grafieken behouden. 94 lokale tests en Chromium-browsercontrole op 320/390/768/1280 px geslaagd; praktijkacceptatie HA/iPhone open. Contracten lokaal, JSON-export/import; alleen indicatieve stroomkosten. Geen release/merge/installatie uitgevoerd. Zie [release notes](RELEASE_NOTES_v1.13.0_RC.md). Oudere statusregels hieronder zijn historische momentopnamen.

> **v1.12.0 RC / 25 oktober 2026:** [PR #17](https://github.com/eelbrethouwer-jpg/energiehuis_card/pull/17) voegt drie onafhankelijke batterijsimulatieprofielen 5/10/15 kWh toe met eigen SOC, bruikbare capaciteit, laad-/ontlaadvermogen en inzicht in gemiste PV door volle batterij of laadlimiet. De bestaande vaste 10-kWh-Home Assistant-sensoren en Alfen-besturing blijven onaangetast. Nog niet gepubliceerd in HACS; CI en praktijkcontrole vereisen bevestiging. Zie [release notes](RELEASE_NOTES_v1.12.0_RC.md) en [datavalidatie](BATTERY_PROFILES_V112.md).

> **Status 25 oktober 2026:** [PR #15](https://github.com/eelbrethouwer-jpg/energiehuis_card/pull/15) met Batterij Simulator 3.0 is samengevoegd met `main`. Release-tag `v1.11.0` is nog niet gepubliceerd. De recentste tag is `v1.10.1` (de bijbehorende releasebeschrijving noemt verwarrend v1.11.0). Een aparte versiecorrectie maakt de interne codeversie en de Lovelace-kaartnaam `1.11.0`, zonder laadbediening te activeren. Batterijsimulatie blijft hypothetisch; Home Assistant-/iPhone-praktijkvalidatie vereist. Zie [release notes](RELEASE_NOTES_v1.11.0_RC.md) en [datacontrole](BATTERY_SIMULATOR_3_DATA.md).

> **Momentopname:** 24 oktober 2026. Bij een volgende chat opnieuw actuele GitHub main, releases, PR's en CI controleren. HACS-installatiestatus en iPhone-weergave zijn niet uit GitHub af te leiden.

### Gecontroleerde productiestatus
- **Repository:** [eelbrethouwer-jpg/energiehuis_card](https://github.com/eelbrethouwer-jpg/energiehuis_card), standaardbranch `main`.
- **Laatste gepubliceerde release:** [V1.8.2 — batterijcapaciteitskeuze hersteld](https://github.com/eelbrethouwer-jpg/energiehuis_card/releases/tag/V1.8.2), 24 oktober 2026.
- **Main-commit bij start v1.9:** `a5f0dcd1d815403140ae67a29cd1ea938d8933ab`.
- **PR #11:** samengevoegd op 24 oktober 2026. Keuzeknoppen 5/10/15 kWh zitten in main.
- **HACS daadwerkelijk bijgewerkt / gebruikersacceptatie van v1.8.2:** gebruiker meldt dat publicatie is gedaan; werking op iPhone / HA is niet onafhankelijk geverifieerd.

### In ontwikkeling
- **v1.9.0-rc.1**, branch `feature/v1.9.0-mobile-app-experience`.
- **Draft-PR:** [#12 – Mobile App Experience](https://github.com/eelbrethouwer-jpg/energiehuis_card/pull/12).
- **Nieuwe code:** mobiele werkbalk, compacte/ruime bediening, responsieve dichtheid, conservatieve offlinewaarschuwing, zichtbaarheidsgestuurde vaste bottomnav met sticky fallback.
- **Nieuwe tests:** `tests/v19.test.cjs`; bestaande v1.7 en v1.8 tests behouden.
- **Documenten:** [release notes](RELEASE_NOTES_v1.9.0_RC1.md) en [standalone PWA verkenning](PWA_SPIKE_v1.9.0.md).
- **CI / handmatige teststatus:** automatische GitHub-controles gestart; uiteindelijke uitkomst en mobiele praktijkwerking nog verifiëren.
- **V1.9.0 NIET gereleased, nog niet geïnstalleerd in HACS.**

### Architectuurbesluit
1. Bestaande HACS/Lovelace-kaart blijft werken en ontvangt zijn `hass`-context van Home Assistant.
2. Alleen frontendwijzigingen in v1.9 RC; geen nieuwe Home Assistant-entiteiten, Alfen/Cupra-commando's of wijziging aan load balancing.
3. Zelfstandige PWA is **nog geen werkend product**. Pas bouwen na aparte test van HTTPS, same-origin routing, Home Assistant-authenticatie, scopes en beperkte caching.
4. Geen tokens of meetgeschiedenis in browseropslag; alleen compacte/ruime UI-voorkeur.
5. `mobile_fixed_navigation: false` kan vaste navigatie uitschakelen bij meerdere dashboardkaarten.

### Acceptatiecriteria vóór release
- CI volledig groen; code op PR diff inspecteren.
- Op iPhone Safari en HA Companion: overzicht, Cupra, slim laden, batterij, kosten, meer, grafiekinteractie, scrollen en compact/ruim.
- Android Chrome, kleine telefoonbreedtes en safe-area.
- Scroll op dashboard met meerdere kaarten; floating-nav verschijnt niet buiten de kaart en overlapt geen bediening.
- Offline/online indicator zonder ongefundeerde liveclaims.
- 5/10/15 kWh-capaciteitselectie blijft bruikbaar.
- Nogmaals controleren: echte sensordata versus simulaties, Zonneplan-contractstart 1 nov 2026, budgetdoel <€200/maand.

### Eerstvolgende stap
PR #12 CI nakijken en eventuele regressies herstellen. Daarna praktijkacceptatie op mobiele apparaten. Pas bij groen resultaat en expliciete releasekeuze PR mergen en definitieve `v1.9.0` releasen.

### Werkafspraak
Eén chat per release/bugfix; nieuwe chat start met dit bestand en actuele GitHub-controle. Maak onderscheid tussen **gebouwd**, **automatisch getest**, **praktisch getest** en **gepubliceerd**.
