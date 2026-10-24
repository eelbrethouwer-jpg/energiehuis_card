# PROJECT_STATUS — Energiehuis

> **Momentopname:** 24 oktober 2026. Bij een volgende chat opnieuw actuele GitHub main, releases, PR's en CI controleren. HACS-installatiestatus en iPhone-weergave zijn niet uit GitHub af te leiden.

## Gecontroleerde productiestatus
- **Repository:** [eelbrethouwer-jpg/energiehuis_card](https://github.com/eelbrethouwer-jpg/energiehuis_card), standaardbranch `main`.
- **Laatste gepubliceerde release:** [V1.8.2 — batterijcapaciteitskeuze hersteld](https://github.com/eelbrethouwer-jpg/energiehuis_card/releases/tag/V1.8.2), 24 oktober 2026.
- **Main-commit bij start v1.9:** `a5f0dcd1d815403140ae67a29cd1ea938d8933ab`.
- **PR #11:** samengevoegd op 24 oktober 2026. Keuzeknoppen 5/10/15 kWh zitten in main.
- **HACS daadwerkelijk bijgewerkt / gebruikersacceptatie van v1.8.2:** gebruiker meldt dat publicatie is gedaan; werking op iPhone / HA is niet onafhankelijk geverifieerd.

## In ontwikkeling
- **v1.9.0-rc.1**, branch `feature/v1.9.0-mobile-app-experience`.
- **Draft-PR:** [#12 – Mobile App Experience](https://github.com/eelbrethouwer-jpg/energiehuis_card/pull/12).
- **Nieuwe code:** mobiele werkbalk, compacte/ruime bediening, responsieve dichtheid, conservatieve offlinewaarschuwing, zichtbaarheidsgestuurde vaste bottomnav met sticky fallback.
- **Nieuwe tests:** `tests/v19.test.cjs`; bestaande v1.7 en v1.8 tests behouden.
- **Documenten:** [release notes](RELEASE_NOTES_v1.9.0_RC1.md) en [standalone PWA verkenning](PWA_SPIKE_v1.9.0.md).
- **CI / handmatige teststatus:** automatische GitHub-controles gestart; uiteindelijke uitkomst en mobiele praktijkwerking nog verifiëren.
- **V1.9.0 NIET gereleased, nog niet geïnstalleerd in HACS.**

## Architectuurbesluit
1. Bestaande HACS/Lovelace-kaart blijft werken en ontvangt zijn `hass`-context van Home Assistant.
2. Alleen frontendwijzigingen in v1.9 RC; geen nieuwe Home Assistant-entiteiten, Alfen/Cupra-commando's of wijziging aan load balancing.
3. Zelfstandige PWA is **nog geen werkend product**. Pas bouwen na aparte test van HTTPS, same-origin routing, Home Assistant-authenticatie, scopes en beperkte caching.
4. Geen tokens of meetgeschiedenis in browseropslag; alleen compacte/ruime UI-voorkeur.
5. `mobile_fixed_navigation: false` kan vaste navigatie uitschakelen bij meerdere dashboardkaarten.

## Acceptatiecriteria vóór release
- CI volledig groen; code op PR diff inspecteren.
- Op iPhone Safari en HA Companion: overzicht, Cupra, slim laden, batterij, kosten, meer, grafiekinteractie, scrollen en compact/ruim.
- Android Chrome, kleine telefoonbreedtes en safe-area.
- Scroll op dashboard met meerdere kaarten; floating-nav verschijnt niet buiten de kaart en overlapt geen bediening.
- Offline/online indicator zonder ongefundeerde liveclaims.
- 5/10/15 kWh-capaciteitselectie blijft bruikbaar.
- Nogmaals controleren: echte sensordata versus simulaties, Zonneplan-contractstart 1 nov 2026, budgetdoel <€200/maand.

## Eerstvolgende stap
PR #12 CI nakijken en eventuele regressies herstellen. Daarna praktijkacceptatie op mobiele apparaten. Pas bij groen resultaat en expliciete releasekeuze PR mergen en definitieve `v1.9.0` releasen.

## Werkafspraak
Eén chat per release/bugfix; nieuwe chat start met dit bestand en actuele GitHub-controle. Maak onderscheid tussen **gebouwd**, **automatisch getest**, **praktisch getest** en **gepubliceerd**.
