# Overdracht aan ChatGPT — HA-01 RC1-correcties (dataversheid, asynchrone meetketen, offline, beveiligde master)

**Status: preview, niet productie.** Gebouwd en automatisch getest met **gesimuleerde** Home Assistant-states. **Niet praktisch getest** (geen echte HA-verbinding). Geen PR, merge, tag, release, HACS, dashboard-, YAML- of productiecodewijziging, geen apparaatbediening.
Opgesteld door Claude Code, 10 november 2026.

## 1. Uitgangssituatie (gecontroleerd)

| | |
|---|---|
| Branch | `preview/claude-premium-pve04` |
| Gereviewde HEAD (vertrekpunt) | `4623470295647253ca9005dfa2c65e17017eb389` — remote = lokaal bij de start |
| `main` (remote, `git ls-remote`) | `62fa09cbd6dd3c4d481c0669c9cbac4f8a39aae9` — niet in de previewbranch gemerged (preview blijft geïsoleerd) |
| HEAD na RC1 | de commit met dit bestand (exacte SHA in het chatbericht) |
| Reviewoordeel vooraf | GO MET OPMERKINGEN voor de gesimuleerde preview; nog geen GO voor een echte HA |

## 2. Correcties

### RC1-A — Dataversheid voor actieve routes
- **Productiecode geverifieerd** (`src/legacy/16-regisseur-cockpit.js`): P1/huis 5 min, GoodWe/Alfen 35 min (stabiel), Cupra 90 min. De productie gebruikt die grenzen alleen voor tegels/balkjes met "Geen energiebalans", **niet** voor een animatie. Een test leest die waarden uit de broncode.
- **Twee grenzen per bron:** toon-TTL (= productie) en een aparte, strengere **route-TTL** voor actieve routes, bewegende lichtpunten, netrichting en balans: P1/huis **60 s**, GoodWe/Alfen **90 s** (conservatief tot de echte frequenties zijn gemeten). Per bron instelbaar met `route_ttl_s` (5 s … toon-TTL, gevalideerd).
- Tussen beide grenzen: toestand **vertraagd** — waarde zichtbaar met "Niet live · bevestigd 10 min geleden", oranje; geen route, geen lichtpunt, geen "Laden", P1 zonder teken/pijl. Status "3/5 meetwaarden actueel · 2 vertraagd".
- De adapter plant de hercontrole ook op de route-grens: lichtpunten stoppen zonder nieuwe HA-update.

### RC1-B — Asynchrone meetketen
- Kritiek ("Controle nodig") **alleen** bij een voldoende synchroon gemeten keten: alle vier actueel, spreiding ≤ 10 s (`balance_max_skew_s`, 1–120 s) en huissensor niet > 2 s ouder dan de nieuwste invoer.
- Niet synchroon + afwijking > 150 W ⇒ `niet vergelijkbaar`, **alle routes gepauzeerd** (geen onbewezen stroomrichting), oranje "Meetketen niet synchroon", niet-kritieke oranje melding.
- Niet synchroon maar sluitend ⇒ `niet vergelijkbaar`, routes blijven (elke route rust op een eigen actuele meter), geen bevestiging.
- Bestaande fail-safes behouden: synchrone tegenstrijdigheid en negatieve huissensor blijven kritiek.
- Gedragswijziging: het scenario "P1 omgekeerd, niet gecorrigeerd" met een 15 min oude Alfen-meting is nu "Meetketen niet synchroon" (alles stil) in plaats van "Controle nodig"; met een actuele Alfen-meting is het weer kritiek (getest).

### RC1-C — Offline-status
- Kop-badge en pil samen: offline = rood **"OFFLINE · geen verbinding met Home Assistant"** / **"OFFLINE geen verbinding sinds HH:MM"**; nooit meer een groene LIVE naast een rode melding.
- Verbonden maar niet alles actueel of gepauzeerd = oranje "LIVE · alleen-lezen"; groen alleen bij verbinding en alle bronnen actueel. Getest op tekst én berekende kleur, inclusief herstel.

### RC1-D — Beveiligde master
- `media_source/resolve_media` behouden; alleen same-origin `/media/`. Nieuw: **time-out 15 s**, veilige terugval bij afgewezen, lege, `/local/`- of externe URL (geen verzoek buiten `/media`), **herstel na herverbinding** (één poging, geen lus). Een geladen beeld blijft staan na verlopen handtekening, ontkoppelen en herverbinding.
- Geen vaste publieke `/local/`-route, geen uitgeschakelde toegangscontrole, geen tokens.
- URL-vorm, authenticatie en iPhone-compatibiliteit **onbevestigd**. De zes controles die alleen in een afzonderlijk goedgekeurde echte HA-test kunnen, staan in `ha/HA_DATA_CONTRACT.md` §5.

## 3. Gewijzigde bestanden (uitsluitend `preview/pve-04/`)

`model.js`, `master.js`, `styles.css`, `ha/contract.js`, `ha/adapter.js`, `ha/live-card.js`, `ha/sim.js` (2 scenario's), `ha/index.html` (testhaken), `ha/HA_DATA_CONTRACT.md`, `README.md`, `HANDOFF_TO_CHATGPT.md`, `tests/ha-adapter.test.cjs`, `tests/ha-live.cjs`, **nieuw** `tests/ha-freshness-sync.test.cjs`, screenshots `ha-live-*` (Chromium, vernieuwd + nieuw `deels-vertraagd` en `niet-synchroon`). **Verwijderd:** `screenshots/ha-live-*-webkit.jpg` en `ha-live-metrics-webkit.json` — die toonden het oude gedrag (groene LIVE bij offline) en konden niet opnieuw worden gemaakt.

## 4. Tests (lokaal, Node 22.23.4, op de werkboom van deze commit)

| Controle | Resultaat |
|---|---|
| PVE-04 Node `TZ=UTC` en `TZ=Europe/Amsterdam node --test preview/pve-04/tests/*.test.cjs` | **112/112** per tijdzone (was 95; nieuw `ha-freshness-sync.test.cjs` 17 tests) |
| HA-LIVE `tests/ha-live.cjs --screenshots`, Chromium 153 | **18/18** (was 12; nieuw: RC1-A ×2, RC1-B, RC1-C, RC1-D ×2) |
| DEMO-master `tests/master.cjs`, Chromium | **30/30** |
| Placeholder-regressie `tests/browser.cjs`, Chromium | **26/26** |
| `tests/perf.cjs` (zonder `--write`), Chromium | master 60 fps bij 4× CPU, desktop en mobiel |
| `node scripts/build.cjs --check` | byte-identiek (`9f4fce00…6388`); geen wijziging buiten `preview/pve-04/` |
| **WebKit** (alle drie de browsersuites) | **NIET UITGEVOERD** — de WebKit-browser ontbreekt in deze sessie (`/opt/pw-browsers/webkit-2359` bestaat niet) en installeren is geblokkeerd (geen netwerk voor installs). Moet opnieuw vóór acceptatie. |
| Productietests (`tests/*.test.cjs`, productie-Chromium-suites) | niet opnieuw uitgevoerd: geen productiewijziging (alleen build-check) |

**Gerichte regressie (selectie):** PV/Alfen actief en 2/5/10/20/35 min niet bevestigd met recente P1 (Node exact op de grens, browser 35 min − 2 s vanwege doorlopende klok); 36 min ⇒ "—"; route-grens zonder update; P1 vertraagd; configuratievalidatie; synchroon vs. 30–85 s spreiding; grens 10,0/10,5 s; updatevolgorde P1 → huis (4–6 s achter) → sluit; huis ná invoer en toch tegenstrijdig ⇒ kritiek; `last_reported`; 400 willekeurige leeftijden/volgordes; browserreeks van zes updates; offline-kleuren; vijf mislukte beeld-resolves; verlopen na laden; herstel na herverbinding; geen fixtures in de LIVE-runtime.

**Screenshots (gesimuleerde HA, Chromium):** actief `ha-live-{desktop,mobiel}-zonneladen.jpg`, gedeeltelijk vertraagd `ha-live-{desktop,mobiel}-deels-vertraagd.jpg`, offline `ha-live-{desktop,mobiel}-offline.jpg`, niet synchroon `ha-live-{desktop,mobiel}-niet-synchroon.jpg`, plus afname/0 W/nacht.

## 5. GO / NO-GO

- **Gesimuleerde preview: GO** — alle vier RC1-punten opgelost en automatisch getest in Node en Chromium. Voorbehoud: WebKit niet uitgevoerd in deze sessie.
- **Installatie in een echte Home Assistant: NO-GO** totdat (1) een onafhankelijke review van deze HEAD is gedaan, (2) de WebKit-suites opnieuw zijn gedraaid en (3) de eigenaar een afzonderlijke, alleen-lezen HA-test expliciet goedkeurt.

## 6. Resterende risico's

1. **Route-TTL en spreiding zijn aannames.** 60/90 s en 10 s zijn niet gemeten. Te streng = geen beweging (veilige kant); te ruim = te lang bewegen op oude data. Meetplan: contract §4.7.
2. **`last_reported` in `hass.states` onbevestigd.** Zonder dat veld worden constante waarden na 60–90 s "vertraagd" en wordt de balans vaker "niet vergelijkbaar".
3. **Huisregel "niet ouder dan de invoer"** veronderstelt dat de huistemplate is afgeleid van P1/PV/Alfen; die definitie staat niet in de repository.
4. **Minder kritieke meldingen:** een echte fout (bijv. omgekeerde P1) wordt pas "Controle nodig" zodra de keten synchroon is gemeten; tot dan "Meetketen niet synchroon" met alle routes stil. Lichtpunten zijn in beide gevallen uit.
5. **Netkaart toont tijdens "niet synchroon" en "Controle nodig" de actuele P1-waarde mét minteken** (pijl en lichtpunten uit, "Richting niet bevestigd"). Dit is bestaand gedrag voor de kritieke stand; ter beoordeling of het teken dan ook weg moet.
6. **Beeldroute:** URL-vorm, verloopduur, Nabu Casa/proxy, herstart en iPhone (Companion-app/Safari) onbevestigd (contract §5). Na een terugval komt het beeld alleen terug bij herverbinding of herladen.
7. WebKit niet getest in deze ronde; echte Safari/iPhone nooit getest.
8. Ongewijzigd uit HA-01: de master staat al openbaar in de repository (PVE-03-referentie); definitie huistemplate open.

## 7. Bevestigingen

Wijzigingen uitsluitend in `preview/pve-04/`. Geen productiecode, bundel, dashboard, YAML, HACS, PR, merge, tag of release. Geen echte HA-verbinding of apparaatbediening. Geen tokens, REST, servicecalls of opslag. Gesimuleerde states alleen in de testomgeving (`ha/sim.js`, `ha/index.html`); de LIVE-runtime kent ze niet (getest).

## 8. Volgende stap

Onafhankelijke review van deze HEAD, inclusief de WebKit-suites in een omgeving met WebKit. Daarna, uitsluitend na expliciet akkoord van de eigenaar, een alleen-lezen HA-test volgens het meetplan (contract §4.7) en de zes beeldcontroles (contract §5).
