# Overdracht aan ChatGPT — HA-01 RC2 (netpresentatie, voorlopig beleid, lifecycle beeldaanvraag)

**Status: preview, niet productie.** Gebouwd en automatisch getest met **gesimuleerde** Home Assistant-states. **Niet praktisch getest** (geen echte HA-verbinding). Geen PR, merge, tag, release, HACS, dashboard-, YAML- of productiecodewijziging, geen apparaatbediening.
Opgesteld door Claude Code, 10 november 2026.

## 1. Uitgangssituatie (gecontroleerd)

| | |
|---|---|
| Branch | `preview/claude-premium-pve04` |
| Gereviewde HEAD (vertrekpunt) | `9a251f9f3527c440b272dce0ebfde2fae56c3886` (RC1) — remote = lokaal, werkboom schoon bij de start |
| `main` (remote) | `62fa09cbd6dd3c4d481c0669c9cbac4f8a39aae9` — niet in de previewbranch gemerged |
| HEAD na RC2 | de commit met dit bestand (exacte SHA in het chatbericht) |
| Oordeel vooraf | GO MET OPMERKINGEN voor de gesimuleerde preview; geen toestemming voor echte HA |

## 2. Correcties

### 1. Netrichting tijdens meetproblemen (alleen presentatie)
- Nieuwe pure functie `M.netPresentation(model)` in `model.js`, gebruikt door `master.js`. `model.grid` (importW, richting), de sensorwaarde en de P1-berekening zijn **ongewijzigd** (getest).
- **Actuele P1 maar netroute stil** (tegenstrijdig of niet synchroon): Net-kaart toont het **absolute** vermogen (`1,88 kW`), zonder minteken of pijl, met de chip **"P1-meting"** en de regel **"Richting niet bevestigd"**; in de compacte mobiele weergave (subregel verborgen) de chip **"P1 · richting onbevestigd"**. Neutrale grijze kaartkleur (`data-direction="unconfirmed"`), niet het teal/cyaan van teruglevering. Schermlezer: "Net: 1,88 kW, P1-meting · richting niet bevestigd (meetketen niet synchroon)".
- **Detailpaneel (diagnose) behoudt:** de ruwe ondertekende sensortekst zoals de bron meldt (bijv. `-1880 W`, vóór tekenconfiguratie), de tijdstempel (bron, kloktijd, leeftijd) en de P1-tekenconfiguratie, plus de reden onder "Richting".
- **Stale P1:** vertraagd ⇒ alleen de grootte, "niet live"; verouderd ⇒ "—"; offline ⇒ "—" en geen ruwe waarde. **0 W:** "0 W · In balans". **Herstel:** zodra de netroute weer actief is, teken, pijl en kleur terug (getest in Node en browser, ook in DEMO).

### 2. Actualiteits- en synchronisatiebeleid
- Gescheiden TTL's (RC1) en bestaande fail-safes ongewijzigd.
- **`last_reported`/`last_updated` = tijdstip van de HA-statusmelding, geen bewezen fysieke meettijd.** Alle gebruikersteksten spreken nu van "HA-bronmeldingen" i.p.v. "meettijden"; het detailpaneel zegt dit expliciet; een test controleert dat geen modeltekst "meettijd" claimt.
- Gedocumenteerd (contract §4.1 en §4b): synchroniciteit van bronmeldingen is een **benadering** tot echte HA-data is onderzocht.
- **60/90 s en 10 s (en de huismarge 2 s) blijven expliciet voorlopige configuratiewaarden**: `C.PROVISIONAL` in `contract.js`, commentaar "VOORLOPIG (RC2)" en contracttekst; getest.

### 3. Beeldroute en lifecycle
- **Hooguit één lopende `resolve_media`-aanvraag**, één hass-wachter en één time-out-timer per kaart; een nieuwe aanvraag breekt de vorige af.
- **Ontkoppelen tijdens een aanvraag:** time-out-timer en wachter worden direct opgeruimd; een laat antwoord wordt genegeerd (geen `img.src`, geen `/media`-verzoek, geen terugvalmelding). Bij opnieuw koppelen start precies één nieuwe aanvraag als het beeld nog niet geladen was.
- Ook geen `callWS` meer als de aanvraag al was afgebroken terwijl op hass werd gewacht. Een geladen beeld blijft ongemoeid.
- Dezelfde veilige terugval en privacygrenzen (alleen same-origin `/media/`, geen `/local/`, geen tokens).

### 4. WebKit
**Niet uitgevoerd.** In deze sessie bestaat de Playwright-WebKit-browser niet (`/opt/pw-browsers/webkit-2359/pw_run.sh` ontbreekt; alleen Chromium is aanwezig) en installeren is geblokkeerd (geen netwerk voor installs). Alle drie de suites (`ha-live.cjs`, `master.cjs`, `browser.cjs` met `--browser=webkit`) stoppen bij het starten van de browser. Er zijn geen oude WebKit-screenshots hergebruikt of teruggezet; geen afhankelijkheden of workflows gewijzigd.

## 3. Gewijzigde bestanden (uitsluitend `preview/pve-04/`)

`model.js`, `master.js`, `styles.css`, `ha/contract.js`, `ha/live-card.js`, `ha/sim.js` (label), `ha/index.html` (testhaak `resolve=slow`), `ha/HA_DATA_CONTRACT.md`, `README.md`, `HANDOFF_TO_CHATGPT.md`, `tests/ha-live.cjs`, `tests/master.cjs` (DEMO-controle aangescherpt voor de onbevestigde netrichting), **nieuw** `tests/ha-rc2.test.cjs`, Chromium-screenshots `screenshots/ha-live-*` (vernieuwd, nieuw: `teruglevering`).

## 4. Tests (lokaal, Node 22.23.4, op de werkboom van deze commit)

| Controle | Resultaat |
|---|---|
| PVE-04 Node, `TZ=UTC` en `TZ=Europe/Amsterdam` | **119/119** per tijdzone (nieuw `ha-rc2.test.cjs`, 7 tests) |
| HA-LIVE `ha-live.cjs --screenshots`, Chromium 153 | **22/22** (nieuw: netpresentatie + detailpaneel + herstel, compact/list, 2× lifecycle) |
| DEMO-master `master.cjs`, Chromium | **30/30** |
| Placeholder-regressie `browser.cjs`, Chromium | **26/26** |
| `perf.cjs` (zonder `--write`) | master 60 fps bij 4× CPU, desktop en mobiel |
| `node scripts/build.cjs --check` + `node --check energiehuis-card.js` | byte-identiek (`9f4fce00…6388`), syntax OK; niets gewijzigd buiten `preview/pve-04/` |
| WebKit (HA-LIVE, master, placeholder) | **NIET UITGEVOERD** — browser niet beschikbaar (zie §2.4) |
| Productietests | niet opnieuw uitgevoerd: geen productiewijziging |

Tijdens het testen gevonden en opgelost: de lifecycletest met een trage resolve was timinggevoelig (pagina-wachttijd 350 ms ≈ vertraging 500 ms); nu 2,5 s vertraging met een expliciete voorwaarde, drie herhalingen geslaagd.

**Screenshots (gesimuleerde HA, Chromium), desktop 1440 en mobiel 390:**
- normale teruglevering: `ha-live-{desktop,mobiel}-teruglevering.jpg`
- niet-synchrone meetketen: `ha-live-{desktop,mobiel}-niet-synchroon.jpg`
- offline: `ha-live-{desktop,mobiel}-offline.jpg`
- verder: zonneladen, afname, 0 W, nacht, deels vertraagd.

## 5. GO / NO-GO

- **Gesimuleerde preview: GO** (Node en Chromium volledig groen). Voorbehoud: WebKit niet uitgevoerd.
- **Alleen-lezen HA-test: nog NO-GO** tot (1) de laatste onafhankelijke review van deze HEAD, (2) WebKit-uitvoering in een omgeving met WebKit (of expliciete acceptatie door de eigenaar dat die ontbreekt) en (3) expliciete, afzonderlijke toestemming van de eigenaar.

## 6. Resterende blockers en risico's

1. **WebKit niet getest** in RC1 en RC2; echte Safari/iPhone nooit getest.
2. **Route-TTL 60/90 s, spreiding 10 s, huismarge 2 s zijn voorlopig** en ongemeten; tijdstempels zijn HA-meldingen, geen fysieke meettijd.
3. `last_reported` in `hass.states` onbevestigd; zonder dat veld meer "vertraagd" en "niet vergelijkbaar".
4. Definitie van de huistemplate onbevestigd (de volgorderegel veronderstelt afleiding uit P1/PV/Alfen).
5. Beeldroute: URL-vorm, verloopduur, Nabu Casa/proxy, herstart en iPhone onbevestigd (contract §5, zes controles). Een `callWS` die al loopt kan niet worden afgebroken; het antwoord wordt alleen genegeerd.
6. Ongewijzigd: de master staat al openbaar in de repository (PVE-03-referentie).

## 7. Bevestigingen

Wijzigingen uitsluitend in `preview/pve-04/`. Geen productiecode, bundel, dashboard, YAML, HACS, PR, merge, tag of release. Geen echte HA-verbinding of apparaatbediening. Geen tokens, REST, servicecalls of opslag. Gesimuleerde states alleen in de testomgeving.

## 8. Volgende stap

Laatste onafhankelijke review van deze HEAD (bij voorkeur inclusief de drie WebKit-suites in een omgeving met WebKit). Daarna, uitsluitend na expliciete toestemming van de eigenaar, de alleen-lezen HA-test volgens het meetplan (contract §4.7) en de zes beeldcontroles (contract §5).
