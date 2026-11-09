# Overdracht aan ChatGPT — HA-01: veilige Home Assistant-integratievoorbereiding

**Status: preview, niet productie.** Gebouwd en automatisch getest met **gesimuleerde** Home Assistant-states. **Niet praktisch getest** (geen echte HA-verbinding). Geen PR, merge, tag, release, HACS, dashboard- of YAML-wijziging.
Opgesteld door Claude Code, 9 november 2026.

## 1. Status vooraf (gecontroleerd)

| | |
|---|---|
| Branch | `preview/claude-premium-pve04`, uitgangs-HEAD `2a5cc26f1170b20ceb17606b1385ec1aa92da6d9` (remote = lokaal) |
| `main` | `62fa09cbd6dd3c4d481c0669c9cbac4f8a39aae9` |
| PR's (REST) | #48–#53 gesloten en gemerged; geen open PR's |
| Laatste release | v1.25.0 (7 november 2026) |
| HEAD na HA-01 | de commit met dit bestand (SHA in het chatbericht) |

Vastgelegd: de eigenaar accepteert de ingebakken lichtlijnen bij 0 W en offline als decoratief; de live-indicatie komt alleen uit de kaarten en de lichtpunten.

## 2. Opgeleverd

1. **Datacontract** — `ha/HA_DATA_CONTRACT.md` en `ha/contract.js`.
   - Zeven bronnen met de standaard-entiteiten en configuratiesleutels exact uit de productiekaart (getest tegen `EH_DEFAULTS`); TTL's uit de v1.25-cockpit.
   - **Alle bronnen zijn bevestigd in code, maar onbevestigd in een echte HA.** De praktijkruimte is niet gekoppeld (bewust niet koppelbaar in HA-01).
   - De definitie van de huisverbruik-template staat niet in de repository en is dus onbevestigd.
2. **Adapter** — `ha/adapter.js`.
   - Leest alleen `hass.states` en `hass.connected`; geeft de originele state-objecten door; geen eigen tijdstempels.
   - Eenheden: W/kW, decimale komma, %. Een ongeldige of ontbrekende eenheid wordt zichtbaar ongeldig (bewust strenger dan productie).
   - Versheid: `last_reported` ≥ `last_updated` ≥ `last_changed`; TTL per bron; "laatste stand" alleen voor stabiele 0 W en SOC; hercontrole op de TTL-grens met één timer.
3. **Koppeling aan PVE-04** — `ha/live-card.js` met `<energiehuis-live-cockpit-preview>` en LIVE-modus in `master.js`/`model.js`.
   - Zelfde master, glaskaarten, weergaven, detailpanelen, reduced motion en decoratieve lijnen.
   - LIVE: geen DEMO-tekst, geen scenario's, geen schommeling; badge "LIVE · alleen-lezen", pil LIVE of OFFLINE, detailpaneel met entiteit, richting en tijdstempelbron.
   - Updates per frame samengevoegd, alleen bij een gewijzigd state-object; `suspend`/`resume` bij ontkoppelen (geen timers, rAF of listeners; dezelfde DOM).
   - Geen bediening, geen servicecalls, geen opslag; `callWS` uitsluitend voor `media_source/resolve_media` (getest).
4. **Beeldroute** — Media Source via `resolve_media` met validatie (alleen same-origin `/media/`), één keer opnieuw oplossen en daarna een veilige terugval. **BLOCKER:** de echte authenticatie, verloopduur, het gedrag bij een HA-herstart en de Companion-apps zijn niet te verifiëren zonder HA. De terugval blijft actief en er is geen vaste `/media`-URL gebruikt.
5. **Privacybeoordeling** — de master staat al openbaar in de repository (PVE-03-referentie); de HA-route beschermt alleen de HA-kopie. De inhoud is een ontwerpbeeld zonder personen, adres of echt kenteken: risico laag tot middel. Details in §6 van het contract.

## 3. Tests (lokaal, op de werkboom van deze commit)

| Controle | Resultaat |
|---|---|
| PVE-04 node-tests (UTC en Europe/Amsterdam) | **95/95** per tijdzone (nieuw: `ha-adapter.test.cjs`, 11 tests) |
| Productietests (UTC en Europe/Amsterdam) | **359/359** per tijdzone |
| `node scripts/build.cjs --check` + `node --check energiehuis-card.js` | Byte-identiek (`9f4fce00…6388`), syntax OK |
| Productie-Chromium-suites | stroomvergelijker, battery-finance, charging-suggestions, mobile-visual, personal-battery-comparison, regisseur-cockpit: alle OK |
| HA-LIVE `tests/ha-live.cjs` | **Chromium 12/12, WebKit 12/12** |
| DEMO-master `tests/master.cjs` | Chromium 30/30, WebKit 30/30 |
| Placeholder-regressie `tests/browser.cjs` | Chromium 26/26, WebKit 26/26 |
| `perf.cjs` | Master 60 fps bij 4× CPU (desktop en mobiel) |

**HA-LIVE dekt:**
- 15 gesimuleerde scenario's: afname, teruglevering, zonneladen, 0 W, offline, unavailable, kW, ongeldige eenheden, ontbrekend, verouderd, constant met en zonder `last_reported`, nacht/laatste stand, tegenstrijdig, P1 omgekeerd (wel en niet gecorrigeerd);
- 200 updates in één burst (1 modelberekening, geen DOM-herbouw); ongewijzigde states (0 berekeningen);
- veroudering zonder update (lichtpunten stoppen via de timer);
- ontkoppelen en opnieuw koppelen;
- beeldroute (getekend; 401 zonder handtekening, 403 bij een vervalste; verlopen ⇒ terugval; geen beeld ⇒ terugval);
- strikte DEMO/LIVE-scheiding; weergaven 320/390/1440 met dekking en detailpaneel; reduced motion.

**Bevindingen tijdens het testen (opgelost):** de samenvatting zei bij een tegenstrijdige meetketen "De fictieve meetketen…", ook in LIVE; nu zonder "fictieve". De pil toonde "LIVE" terwijl er geen verbinding was; nu "OFFLINE".

Screenshots (gesimuleerde HA, Chromium en WebKit): `screenshots/ha-live-{desktop,mobiel}-{zonneladen,afname,nul-watt,offline,constant-nacht}[-webkit].jpg`.

## 4. Blockers en open punten

1. **Echte HA-test** (aparte toestemming): bestaan, eenheden en verversfrequentie van de entiteiten; `last_reported` in `hass.states`; de Media Source-route (authenticatie, verloopduur, herstart, iOS/Android).
2. Definitie van de huisverbruik-template.
3. Besluit van de eigenaar over de openbare GitHub-kopie van de master.
4. Bewuste verschillen met productie: ontbrekende eenheid is ongeldig; netrichting 80/40 W in plaats van ±50 W.

## 5. Bevestigingen

Wijzigingen uitsluitend in `preview/pve-04/`. Geen productiebundel, dashboard, YAML, HACS, PR, merge, tag of release. Geen echte HA-verbinding. Geen tokens, REST, servicecalls of opslag. Geen nieuw privébeeld in GitHub of `/config/www`.

## 6. Volgende stap

Onafhankelijke review van HA-01. Daarna, na afzonderlijk akkoord, een echte HA-testinstallatie volgens het meetplan in §4/§5 van het contract.
