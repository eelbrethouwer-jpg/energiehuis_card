# PROJECT_STATUS — Energiehuis

> **Momentopname:** gecontroleerd op 23 oktober 2026 via GitHub. Dit is geen live statusmonitor. Bij een nieuwe chat altijd repository, releases, open pull requests en CI opnieuw controleren.

## Huidige status (geverifieerd op GitHub)
- **Repository:** [eelbrethouwer-jpg/energiehuis_card](https://github.com/eelbrethouwer-jpg/energiehuis_card), standaardbranch `main`.
- **Laatste gepubliceerde release:** [v1.8.1 – Energy Insights & Cost Control (herstelrelease)](https://github.com/eelbrethouwer-jpg/energiehuis_card/releases/tag/v1.8.1), gepubliceerd 22 oktober 2026.
- **Main-commit vóór dit statusbestand:** `7effcaafc5` (afgekort).
- **Waarom herstelrelease:** v1.8.0 wees volgens GitHub-release notes abusievelijk naar oudere code; v1.8.1 levert de bedoelde implementatie.
- **HACS geïnstalleerde versie en werking in echte Home Assistant/iPhone:** **niet onafhankelijk bevestigd**.
- **Open PR:** [#11 – Virtuele batterij 5/10/15 kWh-keuzeknoppen](https://github.com/eelbrethouwer-jpg/energiehuis_card/pull/11) (op 23 oktober 2026 open, niet gemerged). De laatst bekeken automatische PR-workflows waren geslaagd; praktijkgedrag na merge is nog niet geverifieerd.

## Functionele basis volgens code-/releasedocumentatie
- Home Assistant Lovelace-kaart met P1, GoodWe PV, Alfen, Cupra, Zonneplan en optioneel gas/water.
- v1.8.1: Gas Insights, Kosten & Besparing 2.0, Slim laden 2.1, Zonne-energie Insights, compactere mobiele interface en systeemcontrole.
- Financieel budgetdoel: **€200 per maand**, met onderscheid tussen echte metingen, schattingen en vergelijkingsscenario's.
- Eénfase **1×40 A** en Alfen-laadbeperkingen zijn belangrijke randvoorwaarden voor laadsimulaties.
- **Veiligheidsgrens:** Energiehuis toont laadadvies en analyses, maar stuurt Alfen/Cupra niet aan. Bestaande Active Load Balancing en Home Assistant-backend blijven leidend.

## Belangrijkste bronbestanden
- `energiehuis-card.js` – Lovelace-kaart.
- `packages/` – optionele Home Assistant-helpers/configuratie; niet automatisch geïnstalleerd via HACS.
- `tests/`, `.github/workflows/` – automatische tests.
- `RELEASE_NOTES_v1.8.1.md` en [GitHub Releases](https://github.com/eelbrethouwer-jpg/energiehuis_card/releases).
- `ROADMAP_v1.9.0_PWA.md` – **plan**, geen bewijs van implementatie.

## Open punten en risico's
1. Eerst [PR #11](https://github.com/eelbrethouwer-jpg/energiehuis_card/pull/11) beoordelen/afronden; na merge de 5/10/15 kWh-keuze in het echte dashboard testen.
2. v1.8.1 in echte Home Assistant/HACS controleren: Gas Insights, zonne-energie, slim laden, kostenberekeningen en databronnen.
3. [v1.9.0 standalone PWA-roadmap](ROADMAP_v1.9.0_PWA.md) pas uitwerken na ontwerpkeuze rond veilige authenticatie, hosting en huidig Lovelace-gedrag.
4. Bepaalde README/releasenotes bevatten nog tekst van vóór de reeds gepubliceerde v1.8.1-release; actualiseren bij volgende documentatiewijziging.
5. Home Assistant-entiteiten en werkelijke meetwaarden altijd controleren; niet afleiden uit eerdere gesprekken.

## Eerstvolgende actie
Controleer de nieuwste main, officiële release, PR #11 en CI. Prioriteit: stabiliteit, praktijkverificatie en eventueel herstel van batterijselectie. Bepaal pas daarna de volgende functionele release. Bestaande sensoren, laadbeveiliging en historische data ongemoeid laten.

## ChatGPT-werkwijze
- **Eén nieuwe chat per release, bugfix of afgebakende taak**, binnen het bestaande ChatGPT-project Energiehuis.
- Nieuwe chat: lees dit statusbestand, inspecteer de actuele repository, toets aannames en maak concrete acceptatiecriteria.
- Afronding: uitgevoerde wijzigingen, automatische en handmatige tests, onzekerheden, risico's, volgende actie en eventuele rollback. Statusbestand bijwerken als er daadwerkelijk iets is veranderd.
- Onderscheid altijd **Geverifieerd / Aanname / Advies / Openstaand**. Releasekandidaat ≠ gepubliceerd ≠ geïnstalleerd.
