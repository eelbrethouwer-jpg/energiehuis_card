# Energiehuis v1.21.0 — Battery Dashboard Pro

## Nieuwe grafieken en mobiele lay-out
- **Historie:** duidelijke paarse balken voor gesimuleerd zonneladen, lila voor netladen en groene balken onder nul voor ontladen. De bestaande witte SOC-stippellijn en ontbrekende-datamarkeringen blijven.
- **Vandaag:** stroomprijsgrafiek met subtiele blauwe vulling, markering van écht bekende goedkope uren en optionele balken met de **hypothetische** netlaadhoeveelheid, uitsluitend in de slimme modus. Elk uur is selecteerbaar via tik of toetsenbord en toont prijs en fictieve scenario-lading.
- **Rendement:** horizontale capaciteitsvergelijking voor 5/10/15 kWh op basis van bestaande onafhankelijke simulaties. Werkelijke negatieve of gelijke resultaten blijven zichtbaar; nooit kunstmatige verschillen. Investering, slijtage en detailtabel zijn samengevouwen maar bewerkbaar.
- **Mobile-first:** rustiger donkerblauw design met groen/turquoise accenten, compactere kop, subtiele kleurvlakken en kortere standaarduitleg.

## Wat niet verandert
- Geen wijzigingen aan P1-/prijsparsers, batterijprofielen, efficiëntie, simulatielogica, Home Assistant-entiteiten, netbelasting, laadpaalbesturing, Alfen Active Load Balancing of overige navigatietabbladen.
- Bestaande 7/30 dagen, uurdrilldown, dag/week/maand, datakwaliteitscontrole, historisch SOC en oude 10-kWh-modellen blijven.
- Geen gemeten thuisbatterij: alle historische accuwaarden zijn simulaties.
- De toekomstige goedkope stroomuren zijn geen volledige economische laadplanning. Bij alleen zon wordt geen toekomstige PV-opwek verzonnen. Jaarweergave blijft uitgeschakeld zonder voldoende historie.

## Testen bij release
- JavaScript syntax; alle Node-regressies waaronder `tests/v121-battery-dashboard.test.cjs`; HACS metadata; bestaande stroomvergelijker- en batterij-browsertests in Chromium.
- Browserbreedtes 320/390/768/1280px en financiële invoer achter het vernieuwde detailscherm.
- De GitHub-workflow voert dit opnieuw uit op de merge-commit vóór het maken van tag/release.
- Echte Home Assistant-/Zonneplan-data en iPhone Companion-weergave kunnen alleen lokaal worden getest; CI gebruikt fictieve fixtures.

## Installeren / accepteren
1. Update via HACS naar v1.21.0 als de gepubliceerde release verschijnt.
2. Herlaad Energiehuis en open Batterij → Vandaag, Historie en Rendement.
3. Controleer op iPhone: prijsvelden, laden/ontladen, 5/10/15 kWh, bewerkbare investering/slijtage en geen horizontale scroll.
4. Meld eventuele verschillen van echte sensoren; het project stuurt geen laadcommando's.
