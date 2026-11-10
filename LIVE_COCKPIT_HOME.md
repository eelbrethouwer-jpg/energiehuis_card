# Live Cockpit als Home — integratie, regressierapport, release- en terugdraaiplan

**Status:** gebouwd en automatisch getest, **lokaal** (branch `feature/live-cockpit-home`, niet gepusht). **Niet praktisch getest** in Home Assistant of op een iPhone. Niet gepubliceerd. Versie blijft `1.25.0` (een versie-update hoort in een aparte release-PR, zie [AGENTS.md](AGENTS.md) §6).

## 1. Baseline en herkomst

| | |
|---|---|
| Productiebaseline | `main` @ `62fa09cbd6dd3c4d481c0669c9cbac4f8a39aae9` (remote, gecontroleerd met `git ls-remote`) |
| Goedgekeurde Live Cockpit | `preview/claude-premium-pve04` @ `be0b2999571c479ebf8bde3180c675319e609eea` (HA-01 RC2) |
| Overgenomen modules (ongewijzigde logica) | `model.js`, `master-scene.js`, `master.js`, `styles.css`, `ha/contract.js`, `ha/adapter.js` — SHA-256 per bestand in de kop van `src/legacy/16-live-cockpit.js` |
| Niet overgenomen | DEMO-pagina, scenario's als invoer, testomgeving, `ha/live-card.js` (vervangen door de integratie in de bestaande kaart), de master-afbeelding zelf |

## 2. Wat er is gewijzigd

| Bestand | Wijziging |
|---|---|
| `src/legacy/16-live-cockpit.js` (nieuw) | De zes modules in één lokale `scope` (geen nieuwe globals behalve `EhLiveCockpit`), CSS in een eigen shadow root, en de integratie in `<energiehuis-card>` |
| `src/legacy/16-regisseur-cockpit.js` | Eén voorwaarde: de EnergieRegisseur-cockpit wordt overgeslagen als de Live Cockpit in deze render op Home staat (`this._ehLiveShown`) |
| `src/legacy/02-card-shell.js` | Eén regel in `disconnectedCallback`: `this._ehLiveSuspend()` (lifecycle-callbacks kunnen niet via prototype-patches worden uitgebreid) |
| `scripts/build.cjs` | Nieuw fragment vóór `16-regisseur-cockpit.js` (dat het laatste fragment blijft) |
| `energiehuis-card.js` | Gegenereerd met `node scripts/build.cjs --write` (481 266 → 604 695 bytes) |
| `tests/v127-live-cockpit-home.test.cjs`, `tests/browser/live-cockpit-home.cjs` (nieuw) | Node- en Chromium-acceptatie |
| `tests/v2-build-parity.test.cjs` | Bewust: fragmentteller 18 → 19 |
| `README.md`, dit document | Configuratie, rapport, plannen |

**Twee integratiefixes in `master.js`** (gedocumenteerd in de fragmentkop): (1) de alt-tekst van het beeld noemde in LIVE "DEMO-kaarten"; (2) in een shadow root wordt een documentklik hertarget naar de host, waardoor een échte klik in het detailpaneel dat paneel sloot — nu via `composedPath()`. Fix 2 geldt ook voor de preview en is daar (met programmatische klikken) niet opgevallen.

## 3. Ontwerp van de integratie

- **Schakelaar:** alleen exact `live_cockpit: true` activeert de nieuwe Home. Standaard uit; `EH_DEFAULTS` is ongewijzigd.
- **Configuratie:** dezelfde entiteitssleutels als de kaart (`net`, `zonnepanelen`, `huis`, `laden`, `cupra`, `batterij`). Eigen sleutels hebben het voorvoegsel `live_cockpit_` (`_image`, `_p1_sign`, `_route_ttl_s`, `_balance_max_skew_s`), zodat er geen botsing is met bestaande sleutels.
- **Ongeldige Live Cockpit-configuratie** (bijv. een `/local/`-beeld): de kaart crasht niet. De EnergieRegisseur blijft staan met een duidelijke melding.
- **Rendercyclus:** de bestaande kaart vervangt bij elke hass-update de volledige shadow-DOM. De Live Cockpit is één **blijvend** element met een eigen shadow root, dat na elke kaartrender op Home wordt teruggeplaatst.
  - Cockpit, master, canvas en detailpaneel worden niet opnieuw gebouwd.
  - Meetwaarden gaan alleen bij gewijzigde state-objecten naar het model.
  - Eén eigen timer beoordeelt route- en toon-TTL-grenzen zonder volledige kaartrender.
  - Focus binnen de cockpit overleeft de kaartrender.
- **Eén energieoverzicht:** met de Live Cockpit aan verdwijnt de EnergieRegisseur-cockpit van Home. De bestaande metingen en de grafiek blijven ingeklapt bereikbaar onder "Alle metingen en uitgebreide grafiek". De energiecoach (advies, geen sturing) blijft.
- **Lifecycle:**
  - Weg van Home: cockpit gepauzeerd (geen animatie, timer of aanvraag).
  - Kaart ontkoppeld: idem, en een lopende beeldaanvraag wordt afgebroken.
  - Terug of opnieuw gekoppeld: dezelfde cockpit hervat.
  - Schakelaar uit: cockpit volledig opgeruimd.
- **Beeld:**
  - Alleen `media-source://media_source/…` via `media_source/resolve_media`. Geaccepteerd wordt uitsluitend een same-origin `/media/`-URL; geen `/local/`, geen vaste publieke route.
  - Begrenzing: time-out 15 s, één aanvraag tegelijk, één nieuwe poging na herverbinding.
  - Terugval met duidelijke tekst ("Geen beeld geconfigureerd (live_cockpit_image)", "Beeld kon niet worden opgehaald", "Beeld niet beschikbaar"); de interface en data blijven werken.
- **Alleen-lezen:** geen servicecalls, opslag of netwerk buiten `resolve_media` en het getekende beeld. Geen bediening van Alfen of andere apparatuur (statisch getest). De Laden-schermen en de optionele scriptbediening zijn ongewijzigd.

## 4. Testresultaten (lokaal, Node 22.23.4, Chromium 153, op de werkboom van de lokale commit)

| Controle | Resultaat |
|---|---|
| `node scripts/build.cjs --check` | PASS — byte-identiek, 604 695 bytes, SHA-256 `4dfe9816…a12cc` |
| `node --check energiehuis-card.js` | OK |
| `TZ=UTC node --test tests/*.test.cjs` | **367/367** (was 359; +8 in `v127-live-cockpit-home.test.cjs`) |
| `TZ=Europe/Amsterdam node --test tests/*.test.cjs` | **367/367** |
| Bestaande Chromium-suites (`tests/browser/`): stroomvergelijker, battery-finance, charging-suggestions, mobile-visual, personal-battery-comparison, regisseur-cockpit | **alle 6 geslaagd** (schakelaar standaard uit) |
| Nieuw: `tests/browser/live-cockpit-home.cjs` | **16/16** (inclusief screenshots met de echte master, lokaal) |
| WebKit | **niet uitgevoerd** — geen WebKit-browser in deze omgeving; geaccepteerd voorbehoud voor de eerste praktische test, niet voor de definitieve release |
| CI op GitHub | **niet uitgevoerd** — er is bewust niets gepusht |

**De nieuwe browsersuite dekt:**
- standaard uit (EnergieRegisseur, geen `resolve_media`);
- aan (één energieoverzicht, navigatie Home/Laden/Inzicht/Meer, "Alle metingen" ingeklapt, LIVE zonder DEMO);
- 120 sensorupdates via de echte kaartrender: zelfde cockpit, zelfde `<img>`, 1 resolve, 1 beeldverzoek, 0 structurele DOM-wijzigingen, laatste waarde getoond;
- navigatie naar Laden, Meer, Cupra, Batterij en Kosten en terug (pauze/hervatten);
- ontkoppelen tijdens een hangende beeldaanvraag;
- beeld niet geconfigureerd, mislukt en `/local/` (terugval, geen `/local/`-verzoek);
- ongeldige configuratie (melding + EnergieRegisseur);
- schakelaar tijdens gebruik uit en weer aan;
- echte muisklik op een kaart en in het detail; detail en focus overleven sensorupdates; Escape;
- offline/herstel;
- weergaven 390 (compact), 320 (lijst), 768 (compact), 1300 (overlay), ook met de standaard vaste mobiele navigatie;
- geen horizontale scroll en geen paginafouten; `callService` gooit een fout als hij zou worden aangeroepen (nooit gebeurd).

## 5. Regressierapport

| Gebied | Uitkomst |
|---|---|
| Schakelaar uit (standaard) | Home ongewijzigd: de regisseur-cockpit-suite (6 KPI's, trend, statusregel, snelkoppelingen) slaagt ongewijzigd |
| Laden, Slim laden, Alfen, scriptbediening | Ongewijzigd (charging-suggestions-suite geslaagd; geen code in die fragmenten gewijzigd) |
| Batterij, financiën, persoonlijke vergelijking | Ongewijzigd (suites geslaagd) |
| Kosten, stroomvergelijker, contractopslag | Ongewijzigd (suite geslaagd; geen opslagwijzigingen) |
| Cupra Insights, History, Gas & water (Meer) | Ongewijzigd; met de Live Cockpit aan renderen deze schermen zonder fouten |
| Mobiele weergave en navigatie | mobile-visual geslaagd; Live Cockpit op 320–1300 px zonder overloop |
| HA-entiteiten en opslagkeys | Ongewijzigd; geen nieuwe opslag |
| **Bewust anders met de schakelaar aan** | Op Home verdwijnen de EnergieRegisseur-KPI's, waaronder de **actuele Zonneplan-prijs**, het **netvermogen-trendlijntje** en de snelkoppelingen. Prijs en grafiek blijven bereikbaar via "Alle metingen en uitgebreide grafiek" en Inzicht → Kosten; de snelkoppelingen via de navigatie. |
| Bundelgrootte | +123 KB ongecomprimeerd (481 → 605 KB), vooral CSS (28 KB) en de master-geometrie. Eenmalig geladen. |

## 6. Risico's

1. **Niet praktisch getest:** echte HA-entiteiten, `last_reported` in `hass.states`, werkelijke verversfrequenties, de echte `resolve_media`-URL, verloopduur, Nabu Casa/proxy, de Companion-app op iPhone.
2. **WebKit/Safari niet getest** in deze omgeving.
3. **Voorlopige waarden:** route-TTL 60/90 s, balansspreiding 10 s en huismarge 2 s zijn ongemeten. Tijdstempels zijn HA-meldingen, geen fysieke meettijd.
4. **Rendercyclus van de kaart zelf:** de rest van de kaart rendert nog steeds bij elke hass-update (bestaand gedrag). Het terugplaatsen van de cockpit kost per render een kleine layoutstap. Op trage toestellen in de praktijk meten.
5. **Vaste mobiele navigatie** ligt over het onderste deel van een lang detailpaneel (bestaand ontwerp van de kaart); het paneel is scrollbaar en sluit met × of Escape.
6. **Master staat al openbaar** in de previewbranch (PVE-03-referentie). Deze integratie voegt geen beeld toe aan de repository; het HA-exemplaar staat in de mediamap.
7. **Publiek zichtbaar bij push:** de repository is openbaar. Elke push of PR maakt code en tests direct zichtbaar. Lokale screenshots zijn daarom niet gecommit.

## 7. Release- en terugdraaiplan (pas uitvoeren na expliciete toestemming per stap)

**Stap 0 — publiceren van de branch (toestemming nodig).**
```sh
git push -u origin feature/live-cockpit-home
gh pr create --draft --base main --head feature/live-cockpit-home --title "Live Cockpit als Home (standaard uit)"
```
CI (Node UTC/Amsterdam, alle Chromium-suites) moet groen zijn. Voeg `node tests/browser/live-cockpit-home.cjs` toe aan de workflow in een aparte, goedgekeurde wijziging.

**Stap 1 — praktische test zonder release (toestemming nodig).**
1. Kopieer `energiehuis-card.js` van de PR-HEAD als **aparte** Lovelace-resource met een eigen versieparameter (bijv. `/hacsfiles/…?v=lc1` of een handmatige resource), of test op een testdashboard van de eigenaar.
2. Zet de master in de mediamap: `/media/energiehuis/approved-visual-20261109.webp` (SHA-256 `932d0e74…7ee6`).
3. Zet in de bestaande Energiehuis-kaart `live_cockpit: true` en `live_cockpit_image: media-source://media_source/local/energiehuis/approved-visual-20261109.webp`.
4. Controleer met de checklist:
   - Home toont de Live Cockpit en geen EnergieRegisseur;
   - waarden en richting kloppen met P1, GoodWe en Alfen;
   - lichtpunten alleen bij actuele routes;
   - offline-status bij verbindingsverlies;
   - beeld via `/media/…?authSig=`;
   - `/local/` niet bereikbaar;
   - iPhone Companion-app en Safari;
   - Laden, Batterij, Kosten, Cupra en Meer ongewijzigd;
   - de Alfen-bediening werkt zoals voorheen buiten de cockpit.
5. Meet 30 min de intervallen van `last_reported`/`last_updated` per bron en stel daarna eventueel `live_cockpit_route_ttl_s` en `live_cockpit_balance_max_skew_s` bij.

**Stap 2 — release (toestemming nodig).** Aparte release-PR met `EH_VERSION` en kaartnaam (bijv. `1.27.0`), release notes, merge, tag en GitHub-release volgens AGENTS.md §6 via de goedgekeurde handmatige publicatieworkflow. De schakelaar blijft standaard uit. Een standaard-aan volgt pas na praktische acceptatie inclusief WebKit/iPhone, in een eigen PR.

**Terugdraaien (oplopend in impact):**
1. **Direct, zonder release:** in de kaartconfiguratie `live_cockpit: false` of de regel verwijderen. De EnergieRegisseur-Home is dan exact als in v1.25.0, zonder dat er cockpitcode wordt uitgevoerd.
2. **Bij problemen met de resource zelf:** in HACS de vorige release `v1.25.0` herinstalleren of de vorige resource-URL terugzetten, daarna de browser- of app-cache verversen.
3. **In de code (na merge):** `git revert <mergecommit>` in een PR; daarna `node scripts/build.cjs --check` en de volledige testset. De wijzigingen zijn geïsoleerd: één nieuw fragment, één voorwaarde in `16-regisseur-cockpit.js`, één regel in `02-card-shell.js` en één regel in `scripts/build.cjs`.
4. Er zijn geen data-, entiteit- of opslagmigraties; terugdraaien laat geen resten achter.
