# PROJECT_STATUS — Energiehuis

## Actuele status — 10 november 2026

Gecontroleerd tegen GitHub door ChatGPT. Verifieer actuele HEAD, CI en releases opnieuw vóór de publicatie.

| Onderdeel | Status |
|---|---|
| Integratie in `main` | PR #54 Live Cockpit gemerged op `c69613ae80b306693326039c37aa03276dd0ad21` |
| Gebouwde functionaliteit | Premium PVE-04/HA-01 Live Cockpit in bestaande `<energiehuis-card>`; standaard UIT (`live_cockpit: true` activeert). Beeld afzonderlijk via HA Media Source |
| Releasetraject | Aparte branch `release/energiehuis-v1.27.0-live-cockpit`; release-PR en CI moeten nog worden gecontroleerd |
| Momenteel gepubliceerde release | `v1.25.0`, gepubliceerd 7 november 2026. Een v1.27.0-release is nog NIET gepubliceerd |
| Versie vóór release-PR | `main` op mergecommit #54 gebruikt nog `EH_VERSION = 1.25.0`. De afzonderlijke release-PR beoogt `v1.27.0` in broncode, kaartnaam en HACS-bundel |
| Automatische tests | PR #54 en mergecommit #54: Node UTC/Amsterdam, Chromium en WebKit Live Cockpit, bestaande regressies en validate groen. Voor de release-HEAD opnieuw testen |
| Praktische HA/iPhone-validatie | NIET uitgevoerd. Echte sensoren, media-authenticatie en Companion-app blijven open |
| Veiligheid | Nieuwe cockpit alleen-lezen; geen nieuwe Alfen-servicecalls, opslagmigraties of wijzigingen aan laadregeling |

**Status volgens AGENTS.md §7:** integratie gebouwd: **ja** (main); automatisch getest: **ja** (feature + merge); praktisch getest: **nee**; gepubliceerd: **nee** (v1.27.0).

**Volgende stap:** aparte v1.27.0-release-PR met handmatige publish-workflow, na volledige groene CI en eigenaarstoestemming mergen. Publicatie alleen na afzonderlijke gevalideerde `workflow_dispatch`, nooit op push/merge. Na HACS-update activeren met `live_cockpit: true` en een `live_cockpit_image` uit de afgeschermde HA-mediamap; standaard blijft de huidige Home intact.

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
