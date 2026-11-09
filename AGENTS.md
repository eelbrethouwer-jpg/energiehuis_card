# AGENTS.md — gezamenlijke werkwijze Energiehuis

Deze regels gelden voor iedere ontwikkelagent (ChatGPT, Claude Code en andere) en voor menselijke bijdragers aan `eelbrethouwer-jpg/energiehuis_card`. Agent-specifieke aanvullingen staan in een eigen bestand (bijv. `CLAUDE.md`) en mogen deze regels niet afzwakken of tegenspreken.

## 1. Bron van waarheid
- **GitHub is de bron van waarheid.** Wat niet op GitHub staat (lokale bestanden, chatgeschiedenis, losse screenshots) geldt niet als vastgestelde projectstatus.
- Controleer bij de start van elke taak de actuele remote `main`-HEAD, open PR's, releases en tags. Noem de gecontroleerde SHA in je verslag.
- `PROJECT_STATUS.md` bevat de actuele, gedateerde status. Werk het bovenste statusblok bij wanneer een PR de status verandert.

## 2. Branches en PR's
- Werk vanuit de **actuele `main`**. Rebase of merge `main` in je branch als die tijdens je werk is verschoven, en meld dat.
- Eén taak = één afzonderlijke branch = één PR. Geen directe commits of pushes op `main`.
- Gebruik een duidelijke branchnaam met prefix, bijv. `feature/…`, `fix/…`, `docs/…`, `release/…`, `preview/…`.
- Push niet op de branch van een andere agent of bijdrager zonder expliciete afspraak.
- Open nieuwe PR's als **draft** totdat alle verplichte controles zijn uitgevoerd en gerapporteerd.
- `preview/…`-branches (zoals `preview/chatgpt-premium-pve01`) zijn geïsoleerde demo's. Ze worden niet in `main` gemerged en niet vermengd met productiewerk zonder aparte opdracht.

## 3. Broncode en build
- **Broncode staat in `src/`** (`src/legacy/*.js` en `src/engines/*.cjs`).
- **`energiehuis-card.js` is de gegenereerde HACS-bundel.** Bewerk die nooit met de hand. Wijzig de bron en genereer de bundel met:
  ```sh
  node scripts/build.cjs --write
  ```
- De volgorde van fragmenten staat in `scripts/build.cjs`. Voeg geen onbekende bestanden toe aan `src/legacy/`.

## 4. Verplichte controles
Voor iedere PR die code, bundel, build of tests raakt:
```sh
node scripts/build.cjs --check
node --check energiehuis-card.js
TZ=UTC node --test tests/*.test.cjs
TZ=Europe/Amsterdam node --test tests/*.test.cjs
```
- **Relevante Chromium-tests** uit `tests/browser/` (Playwright `1.56.1`), minimaal de suites die het gewijzigde gebied raken. De volledige set staat in `.github/workflows/stroomvergelijker-browser.yml`.
- **Regressiecontrole:** controleer dat bestaande schermen en functies (Slim laden, batterij, contractopslag, kosten, Cupra Insights, History, optionele scriptbediening) ongewijzigd blijven werken.
- Documentatie-only PR's: minimaal `git diff --check` en de bevestiging dat alleen documentatie is gewijzigd.
- Een test die niet is uitgevoerd, wordt als **niet uitgevoerd** gerapporteerd, nooit als geslaagd.

## 5. Behoud van bestaand gedrag
- Behoud bestaande **Home Assistant-entiteiten, opslagkeys (localStorage/helpers) en functionaliteit**. Wijzigingen daaraan alleen met een expliciete opdracht en een migratiepad.
- **Geen wijzigingen aan Alfen-laadbediening, veiligheidsgrenzen of elektrische configuratie** (o.a. 1×40 A-aansluiting, Active Load Balancing, `charge_control_enabled` standaard uit) zonder expliciete opdracht.
- Geen nieuwe Home Assistant-servicecalls of schrijfacties zonder expliciete opdracht.
- Gefabriceerde of gesimuleerde waarden worden altijd als zodanig gelabeld; ontbrekende meetwaarden blijven zichtbaar ontbrekend.

## 6. Merge, tag, release en publicatie
- **Geen merge, tag, release of HACS-publicatie zonder expliciet akkoord** van de eigenaar (`eelbrethouwer-jpg`) voor die specifieke actie.
- De 14 historische `publish-v*.yml`-workflows voor v1.15.0–v1.24.1 zijn buiten werking gesteld: geen `push`-trigger, publicatiejob permanent geblokkeerd en alleen leesrechten. Schakel ze niet opnieuw in. Voor nieuwe releases is een afzonderlijk gereviewde, handmatige publicatieworkflow met expliciete bevestiging vereist. `publish-v1250.yml` blijft handmatig en is niet gewijzigd.
- Versie-updates (`EH_VERSION` en de kaartnaam in `src/`) horen in een aparte release-PR.

## 7. Statusbegrippen
Maak in verslagen, PR's en `PROJECT_STATUS.md` altijd onderscheid tussen:
- **Gebouwd** — code staat op een branch of `main`.
- **Automatisch getest** — lokaal of in CI geslaagd, met vermelding van commit en commando's.
- **Praktisch getest** — gecontroleerd in een echte Home Assistant / op een fysiek apparaat.
- **Gepubliceerd** — GitHub-release en/of HACS-update daadwerkelijk uitgevoerd.

## 8. Reviews en verslagen
Elke review of afsluitend verslag vermeldt:
1. De **exacte commit-SHA** die is beoordeeld (en of dat de PR-HEAD of een mergecommit is).
2. De **uitgevoerde tests** (commando's, tijdzones, browsersuites).
3. De **resultaten** (aantallen geslaagd/mislukt; CI-status als die is gecontroleerd).
4. **Risico's** en mogelijke regressies.
5. **Open punten**, inclusief controles die niet konden worden uitgevoerd en waarom.

Een review is pas een review als die daadwerkelijk is uitgevoerd op de genoemde SHA. Een nieuwe push na de review vraagt om een nieuwe review.
