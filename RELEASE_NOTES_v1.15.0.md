# Energiehuis v1.15.0 — Leveranciers vergelijken

## Nieuw
De pagina **Kosten & Besparing** heeft één centrale leveranciersvergelijking in plaats van de oude Vattenfall 1- en 3-jaarsvergelijking.

- Vergelijk je opgeslagen stroomcontracten (bijvoorbeeld Zonneplan, ANWB, Essent en Eneco) rechtstreeks op de Kosten-pagina.
- Beschikbare contracttarieven, vaste leverancierskosten en broncontroledatum zijn direct zichtbaar, ook zonder volledige P1-meetdag.
- Kies een leverancier uit de tarievenlijst en sla hem op; eigen contracten toevoegen, bewerken en verwijderen blijft mogelijk.
- Bekijk indicatieve historische kosten, besparingsverschillen en grafische resultaatbalken **zodra** de benodigde P1-uren en historische prijsgegevens compleet zijn.
- Een waarschuwing verschijnt als een andere leverancier dan Zonneplan als referentie is ingesteld.
- Op de eerste dag van een periode verschijnt een gerichte melding over ontbrekende afgeronde meetdagen.

## Behouden
- Zonneplan-kosten vandaag en deze maand, slimme timing, budgetprognose en databronnen waaronder Engie-gas.
- Energiemeters, zonnepanelen, Cupra, laadplanning en virtuele batterij.
- Home Assistant-configuratie, bestaande P1- en Vattenfall-sensoren, opslagformaat van contracten en export/import.
- Alfen Active Load Balancing; er zijn geen nieuwe laadcommando's toegevoegd.

## Belangrijke beperkingen
- Het resultaat is een **indicatieve scenariovergelijking**, geen actuele persoonlijke offerte en geen definitieve energiefactuur.
- Dynamische contracten vereisen passende prijs- en belastinggegevens. Ontbrekende gegevens worden niet verzonnen; een contract kan wel zichtbaar maar nog niet berekenbaar zijn.
- De bestaande cumulatieve Vattenfall-grafiek is verwijderd uit de Kosten-pagina. Er is **geen nieuwe interactieve historische lijngrafiek** toegevoegd; wel bestaande grafische resultaatbalken bij berekende kosten.
- Contracten blijven per browser/apparaat opgeslagen. Exporteer een back-up als je van apparaat wisselt.
- Zonneplan startte op 1 november 2026: de eerste volledige historische dag komt pas na afloop van die datum beschikbaar, mits alle Recorder-gegevens aanwezig zijn.

## Validatie
- GitHub Node-/frontend-/HACS-checks en Chromium-browsertest met testgegevens waren geslaagd bij de acceptatie van PR #26.
- Release-build wordt opnieuw automatisch gevalideerd voor het aanmaken van de definitieve GitHub-tag.
- **Home Assistant-/iPhone-praktijktest niet onafhankelijk uitgevoerd.** Werkelijke tarief-/kostenweergave kan afhangen van je sensoren en tariefbron.

## Bijwerken
Installeer `v1.15.0` via HACS zodra deze GitHub-release is gepubliceerd en herlaad Home Assistant / de app. Bestaande opgeslagen contracten worden niet automatisch aangepast.
