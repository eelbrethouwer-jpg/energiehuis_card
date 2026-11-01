# Energiehuis v1.17.0 — Batterijgrafieken en compact overzicht

## Nieuw
- Eén centraal Batterij 4.0-dashboard: direct keuze voor 5, 10 of 15 kWh en 7 of 30 historische dagen.
- Interactieve **laad-/ontlaadgrafiek per kalenderdag** op basis van de bestaande P1-uurdata en virtuele batterijsimulatie.
- Kleuren: **groen** = laden met zonne-overschot, **blauw** = laden uit het net, **oranje** = ontladen naar het huis, **grijs** = ontbrekende gegevens.
- Dag terug/vooruit en tikken/klikken op een uur, met SOC, laad-/ontlaadenergie, netafname, teruglevering en eventuele historische prijs in de uurdetails. Toetsenbordbediening is ondersteund.
- Minder scrollen: bestaande SOC-grafiek, uitgebreide batterijprofielen, vaste 10-kWh-HA-simulatie en oudere dagtotalenvergelijking zijn uitklapbaar.
- De financiële Batterij 4.0-berekening en eigen aanschaf-/slijtagekosten blijven behouden; invoer wordt beter vastgehouden bij het opnieuw tekenen van de kaart.
- Compacte weergave voor iPhone, tablet en desktop.

## Behouden
Bestaande Home Assistant-entiteiten, P1-/GoodWe-/Zonneplan-bronnen, Cupra, Alfen Active Load Balancing, stroomvergelijker en kostenfuncties. Geen nieuwe laadcommando's, YAML-wijzigingen of migraties.

## Let op: dit is een *virtuele* batterij
De grafiek toont **gesimuleerde**, niet werkelijk gemeten laad-/ontlaadmomenten. De P1-uurstatistieken geven geen exacte volgorde binnen een uur; ook de financiële uitkomsten zijn indicatieve scenario's. Zonder voldoende P1- en tariefhistorie kunnen sommige uitkomsten ontbreken.

## Teststatus en installatie
- Automatische Node-regressies, JavaScript-/HACS-validatie en Chromium-browsertests op fictieve gegevens (inclusief dag-/uurinteractie en 320/390/768/1280px) worden opnieuw uitgevoerd vóór publicatie.
- **Een praktijkcontrole met echte Home Assistant/P1/Zonneplan-data op de iPhone is nog niet uitgevoerd.**
- Update naar **v1.17.0** via HACS zodra deze verschijnt; herlaad de Home Assistant-kaart en open **Batterij**.

Technische review en acceptatiecriteria: `RELEASE_NOTES_v1.17.0_RC.md`.
