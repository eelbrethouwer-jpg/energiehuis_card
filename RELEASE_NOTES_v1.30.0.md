# Energiehuis v1.30.0 — Praktijkruimte live en maandkosten

## Nieuw

- **Live Praktijkruimte:** de bestaande tegel toont nu de echte Home Assistant-vermogensmeter (W/kW). Bewegende lichtpunten naar de Praktijkruimte worden alleen bij actueel, geldig positief vermogen weergegeven.
- **Kleine kostenregel:** onder het actuele wattage verschijnt **Kosten deze maand: ± € ...** met `(deels)` bij onvoldoende historische dekking.
- **Detailpagina:** actueel vermogen, kWh deze maand, indicatieve dynamische kosten en een compacte daggrafiek over maximaal de laatste 14 dagen.
- **Datakwaliteit:** ontbrekende maandstart, grote meetgaten, prijsuren zonder historie en tellerresets worden niet verzwegen. Onvoldoende data betekent geen verzonnen bedrag.

## Eenmalige configuratie in de bestaande kaart

```yaml
praktijk: sensor.praktijkruimte_kwh_meter_vermogen
praktijk_energie: sensor.praktijkruimte_kwh_meter_energie_import
```

Laat `huis:` en andere bestaande instellingen staan. De energiemeter moet cumulatieve Wh of kWh leveren. Recorder moet de historische waarden van de praktijkmeter en de bestaande Zonneplan-prijssensor bevatten. De maandhistorie kan korter zijn door Recorder-retentie.

**De kosten zijn indicatief, niet de exacte extra energierekening.** De berekening waardeert meterstandenverschillen tegen geregistreerde dynamische prijzen, zonder exacte toerekening van eigen zonnestroom. Het bedrag bevat contractcomponenten slechts voor zover de prijssensor ze bevat.

## Compatibiliteit en veiligheid

- De praktijkruimte wordt niet dubbel opgeteld bij Huis: het vermogen zit al in de bestaande P1 + PV − Alfen-berekening.
- Bestaande Alfen-laadregeling, netveiligheid, energieberekeningen, lokale opslag en Home Assistant-entiteiten zijn niet gewijzigd.
- Alleen-lezen: geen nieuwe Home Assistant-servicecalls.
- De integratie is optioneel; zonder `praktijk` blijft de tegel ongekoppeld.

## Kwaliteitsstatus

Feature PR #65, HEAD `e70dea3efe5d82f30f19111c638c71c1977b4d48`, is gecontroleerd met vier geslaagde GitHub-workflows: HACS/build, Node-regressies in UTC en Europe/Amsterdam, supplier-regressie en uitgebreide Chromium/WebKit-tests met fictieve praktijkruimtemetingen. De release-HEAD wordt opnieuw volledig gevalideerd en de beveiligde handmatige publish-workflow voert de tests opnieuw uit voor tag/release.

**Niet praktisch getest:** echte Home Assistant-installatie en iPhone, werkelijke historische prijsdekking en metersemantiek.

**Owner-akkoord:** 14 november 2026: na geslaagde tests mergen en releasen. Publicatie uitsluitend via `publish-v1300.yml` op `main` met de bevestiging `PUBLISH_v1.30.0`.
