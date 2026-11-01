# Energiehuis v1.15.0-rc.1 — Leveranciersvergelijking op Kosten-pagina

## Doel
Vervang de Vattenfall 1-/3-jaarsvergelijking in **Kosten & Besparing** door één centrale vergelijking van opgeslagen stroomcontracten, waaronder Zonneplan, ANWB Energie, Essent en Eneco. De gebruiker kiest de contracten zelf uit de bestaande tarievenlijst; de app voegt geen contracten stilzwijgend toe.

## UI-wijzigingen
- Onder de bestaande KPI's **Zonneplan vandaag**, **Zonneplan maand** en **Slimme timing** staat direct **Leveranciers vergelijken**. Geen aparte stroomvergelijker-subpagina of extra open-knop.
- Toon per opgeslagen contract onmiddellijk het bekende tarief / dynamische prijsopbouw, vaste maand-/dagkosten en broncontroledatum, ook zonder P1-uurhistorie.
- Behoud contractselectie (één keer opslaan), eigen contract, bewerken, verwijderen, lokale opslag, export/import, periodekeuze en bestaande read-only berekeningsregels.
- Zodra de P1- en prijshistorie compleet is: dezelfde kostenresultaten, vergelijking tegen een expliciet ingestelde Zonneplan-referentie, en bestaande grafische resultaatbalken.
- Als een andere leverancier als referentie staat ingesteld, toon een waarschuwing en bied de knop **Zonneplan als referentie** aan.
- Op de eerste dag van de maand / jaar: verklaar waarom er nog geen afgeronde meetdag is, in plaats van de generieke fout over 1–366 dagen.
- De oude Vattenfall-maand-/jaar-tabellen en oude cumulatieve Vattenfall-grafiek verdwijnen uit de Kosten-weergave.

## Niet gewijzigd
- De bestaande dag/maand Zonneplan-KPI's, budgetprognose, Engie-gas, financiële databronnen, slimme timing en virtuele batterij blijven behouden.
- Geen nieuwe Home Assistant-servicecalls, laadcommando's, aanpassing aan Alfen/P1/GoodWe, configuratie-YAML of bestaande kostenentiteiten.
- Opgeslagen contracten blijven in hetzelfde localStorage-schema en worden niet automatisch hernoemd of omgezet.
- Oude Vattenfall-sensoren/configuratie blijven ongemoeid voor compatibiliteit, maar worden niet meer als vergelijking weergegeven of voor de oude kostenvergelijkingsgrafiek uit Recorder opgevraagd.

## Financiële nauwkeurigheid
Dit is een **indicatief** leveranciersscenario op gemeten historische P1-uren, geen offerte of afrekening. Dynamische prijzen vereisen een geschikte historische (kale) prijsbron en een volledige urenreeks. Voor kostenverschillen ontbreken op 1 november 2026 nog volledige Zonneplan-dagen. Een opgeslagen contract kan daarom wél een tarief tonen maar nog **niet berekenbaar** zijn. Bij ontbrekende prijs-, belasting-, teruglever- of meetgegevens worden geen fictieve kosten of besparingen getoond.

## Acceptatie vóór merge/release
1. Alle Node-tests en JavaScript-syntaxcheck groen; testaanpassingen zijn inbegrepen.
2. Browser/Chromium: contractselectie, opslaan, herladen, bewerken, verwijderen, import/export, maand/jaar/eigen periode, foutmelding zonder historie, Zonneplan-referentie, geen horizontale overflow op 320/390/768/1280px.
3. Home Assistant iPhone: bestaande KPI's en budgetblokken, lokale contractopslag, dropdowns en grafiekresultaten controleren.
4. Er mag geen onbedoelde historische Vattenfall-Recorder-call en geen nieuwe Home Assistant-servicecall plaatsvinden.
5. Controleer actuele leverancierstarieven en contractvoorwaarden vóór een financiële beslissing.

**Status:** conceptbranch / releasekandidaat; geen release, geen merge naar main en geen installatie in Home Assistant. Browser- en iPhone-praktijkacceptatie staan open.
