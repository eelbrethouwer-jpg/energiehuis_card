# Overdracht aan ChatGPT — PVE-04: interactieve cockpit op de goedgekeurde master

**Status: DEMO — niet productie.** Geen PR, merge, tag, release of HACS-publicatie. De productiekaart is ongewijzigd.
Opgesteld door Claude Code, 9 november 2026. Opdracht: "GO — Energiehuis PVE-04: bouw de interactieve preview" (master = definitieve visuele referentie, door de eigenaar goedgekeurd).

## 1. Branchstatus

| | |
|---|---|
| Branch | `preview/claude-premium-pve04` |
| Uitgangs-HEAD (gecontroleerd) | `466d41306a0b2be886bdcda7953067c81a284df2` (remote = lokaal vóór aanvang) |
| `main` | `62fa09cbd6dd3c4d481c0669c9cbac4f8a39aae9` (ongewijzigd) |
| HEAD na deze ronde | de commit die dit bestand bevat (exacte SHA in het chatbericht) |

De diff blijft binnen `preview/pve-04/`. **Geen privébestanden gecommit:** het originele PNG, de pilotbeelden (1B-a) en eventuele clean plates staan niet in de repository. De master wordt niet gekopieerd: de preview verwijst naar het bestand dat al in `preview/pve-03/reference/` staat.

## 2. Wat is gebouwd

| Eis | Uitvoering |
|---|---|
| Scène, dakpannen, objecten, kleuren en kaartposities behouden | De master is ongewijzigd de achtergrond (beeldverhouding 1330:748, geen uitsnede). Kaartposities komen 1-op-1 uit `cleanplate/overlay-map.json` (`master-scene.js`, gegenereerd en met `--check` getest). |
| Ingebakken voorbeeldwaarden visueel volledig vervangen | Live kaarten liggen ondoorzichtig over elke ingebakken kaart, met de kaartmaat + 6 px (onder + 8 px). De datum/tijd-pil wordt afgedekt door een DEMO-pil met de echte klok. In de compacte weergave dekken waardeplaatjes de kaarten af. **Getest op 7 viewports:** elk afdekvlak bevat de ingebakken kaart + 5 px, met een kleinste overmarge van 0,65 px op 320 px en 3,25 px op 1920 px. |
| Stromen alleen bij geldige, actuele waarden; geen misleidende stroom bij 0 W, offline of verouderd | Per ingebakken lijn een **rustlaag**, eenmalig in de browser berekend. Die vervangt lijn en gloed door de omgeving: laagfrequent uit de pixels buiten lijnen en kaarten, het fijne patroon blijft behouden. Aan zolang de route niet actief is (model.js, zonder uitsteltijd); bij een actieve route zijn de ingebakken lijn en bewegende deeltjes in stroomrichting zichtbaar. Bij offline staan de deeltjes direct stil en doven ze uit. |
| Simulatiestatus virtuele batterij | Kaart met label "Simulatie" en "Geen fysieke opslag"; geen lijn. |
| Praktijkruimte | "Nog niet gekoppeld" zolang er geen meting is. De gestippelde lijn is onderdrukt en wordt alleen zichtbaar in het expliciete simulatiescenario. |
| DEMO-waarden | Permanente badge "DEMO — fictieve meetwaarden", DEMO-pil in het beeld en het voorvoegsel "DEMO ·" in de samenvatting. Nieuw scenario **"0 W (alles stil)"**. |
| Veilige mobiele terugval | Onder 900 px containerbreedte blijft de master volledig zichtbaar, met ondoorzichtige waardeplaatjes; de interactieve kaarten staan leesbaar onder het beeld (targets ≥ 48 px). Zonder scène of bij een beeldfout: alleen de interface. Lukt de rustlaag niet (`file://`): een donkere dimlaag plus een melding. |

De oude placeholder- en privélaag-cockpit blijft beschikbaar via `?scene=placeholder` / `?scene=private` en wordt als regressie getest.

## 3. Tests (lokaal uitgevoerd in deze sessie, op de werkboom van deze commit)

| Controle | Resultaat |
|---|---|
| PVE-04 node-tests (UTC en Europe/Amsterdam) | **84/84** per tijdzone (nieuw: `master-scene.test.cjs`, 5 tests) |
| Productietests `tests/*.test.cjs` (UTC en Europe/Amsterdam) | **359/359** per tijdzone |
| `node scripts/build.cjs --check` | Byte-identiek, SHA-256 `9f4fce00…6388` |
| Master-browsersuite `tests/master.cjs` | **Chromium 153: 21/21**, **WebKit 26.6: 21/21** (performance alleen Chromium/CDP) |
| Regressie placeholder/privélaag `tests/browser.cjs` | **Chromium 26/26**, **WebKit 26/26** |
| Kaartdekking | Geslaagd op 320×700, 390×844, 768×1024, 1024×768, 1330×748, 1440×900 en 1920×1080, plus 200 % tekst |
| **Pixeltoets ingebakken lijnen** (aandeel lijnkleur op de kernlijn) | Actief: zon 0,92 · net 0,59–0,65 · Cupra 0,39 · kaart-auto 0,39 · praktijk (simulatie) 0,53. **0 W, offline: 0,00 op alle lijnen. Verouderde P1: netlijn 0,00.** Drempel ≤ 3 % én ≤ 15 % van actief. **Geen blocker.** |
| Performance (Chromium, 1440×900, 4 actieve routes) | 60 fps / p95 16,7 ms bij 1× en bij 4× CPU (DOEL). Heapgroei na 200 updates ~0,14 MB. Rustlagen: eenmalig ~0,43 s rekentijd bij het laden. `perf.cjs`: master-variant 60 fps bij 4×, desktop en mobiel. |

Screenshots (Chromium en WebKit): `screenshots/master-{desktop,mobiel}-{actief,0w,offline}[-webkit].jpg`; meetwaarden in `master-metrics*.json` en `perf.json`.

## 4. Beperkingen en open punten

1. **Onderdrukte lijn = zachte veeg:** op 200–300 % zichtbaar als een kleurloze, wazige band, vooral over het paneelraster en de pannen rechts van de dakkapel, en licht over gevel en bestrating bij de netlijn. Er is geen licht of kleur van de stroom meer zichtbaar. Dit vraagt een **visueel oordeel van de eigenaar**.
2. **Rekentijd bij het laden** ~0,4 s op de hoofdthread. Kan later naar een Web Worker of `OffscreenCanvas`.
3. **Kleur van de netlijn** ligt vast (cyaan) voor zowel afname als teruglevering; de richting zit in de deeltjes en de kaart.
4. **`file://`:** canvas niet leesbaar in Chromium en WebKit ⇒ dimterugval. Via http(s) en in Home Assistant (same-origin `/local/` of Media Source) werkt de rustlaag.
5. **Leesbaarheid op de master tussen 900 en 1100 px:** tekst rond 11–13 px (schaalt met de master).
6. Niet getest op echte Safari (iPhone/macOS) of op een fysiek toestel; Playwright-WebKit is headless.
7. Kenteken "CUPRA BORN" en merklogo blijven in beeld (geaccepteerd door de eigenaar).

## 5. Bevestigingen

- Geen PR, merge, tag, release of HACS-publicatie; productiekaart, `dist/` en `src/` ongewijzigd.
- Geen aankopen, geen externe beeld- of AI-diensten, geen nieuwe installaties.
- Geen privébestanden openbaar gemaakt (origineel PNG, pilotretouches en clean plates blijven privé). Gecommitte screenshots tonen de master, die al in de repository stond.

## 6. Voorgestelde volgende stap

Visuele review door de eigenaar van de 6 screenshots (plus de WebKit-varianten), met name de rustlagen op 100 % en 200 %. Daarna, na akkoord, de HA-integratie: de master laden via een geauthenticeerde route (Media Source) en de leeslogica op echte entiteiten aansluiten.
