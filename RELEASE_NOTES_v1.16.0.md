# Energiehuis v1.16.0 — Batterij 4.0: financieel simuleren

## Nieuw
- Kies **7 of 30 afgeronde dagen** historische P1-uurgegevens voor de batterijscenario's.
- Vergelijk **5, 10 en 15 kWh** met eigen bruikbare capaciteit, laad-/ontlaadvermogen en een chronologische SOC-simulatie.
- Bekijk een **kostenoverzicht**: vermeden stroominkoop, kosten van goedkoop netladen, gemiste terugleververgoeding en operationele besparing.
- Vul desgewenst **aanschafprijs inclusief installatie** en **slijtagekosten per ontladen kWh** in; zonder die gegevens wordt geen terugverdientijd verzonnen.
- Een **hypothetische terugverdientijd** wordt pas getoond bij minimaal 21 complete meetdagen, 90% uurdekking in de 30-dagenperiode, ingevulde kosten én een positief berekend voordeel.
- Beter gedrag bij ontbrekende uurgegevens en bij het wisselen van 7 naar 30 dagen; vertraagde Home Assistant Recorder-antwoorden van een vorige periode worden genegeerd.
- Compacte financiële invoer en vergelijking op iPhone, tablet en desktop.

## Behouden
- De bestaande vaste **10-kWh Home Assistant-batterij** en bijbehorende sensorwaarden blijven apart zichtbaar.
- Batterij Simulator 3.0, de 5/10/15-kWh-profielen, bestaande stroomvergelijker, budgetweergave, PV, P1 en Cupra blijven aanwezig.
- **Geen nieuwe laadcommando's**, geen verandering aan Alfen Active Load Balancing en geen YAML-migratie.

## Betrouwbaarheid en aannames
- Historische simulatie met uurmetingen; een echte batterij kan afwijken doordat netafname en teruglevering binnen één uur niet in werkelijke volgorde bekend zijn.
- Standaard zijn **88% rondrendement**, **3 kW laad-/ontlaadvermogen**, **€0,25/kWh vermeden inkoop** en **€0,08/kWh gemiste teruglevering** bestaande rekenaannames wanneer historische tarieven ontbreken; geen persoonlijke offerte of gegarandeerd rendement.
- De slimme netlaadstrategie gebruikt achteraf bekende prijzen en is **geen uitvoerbaar 1×40A-laadplan**.
- Het optionele jaarbedrag vermenigvuldigt dertig gemeten dagen; het is **geen betrouwbare jaarprognose**, omdat seizoenen, toekomstige tarieven en degradatie niet volledig worden meegenomen.
- De ingevoerde aanschaf-/slijtagebedragen gelden alleen tijdens de huidige kaartsessie.
- Zonder voldoende volledige P1- en prijsgegevens zijn sommige uitkomsten niet beschikbaar.

## Controle en installatie
- Automatische Node-regressies, frontend-, JavaScript-/HACS- en Chromium-browsertests op testgegevens worden vóór GitHub-publicatie opnieuw uitgevoerd.
- Een praktijkcontrole in jouw **Home Assistant op iPhone met echte Recorder-/Zonneplan-data** is nog niet uitgevoerd.
- Installeer de release via HACS zodra `v1.16.0` verschijnt en herlaad de Home Assistant-app.

Technische details en acceptatiecriteria staan in `RELEASE_NOTES_v1.16.0_RC.md`.
