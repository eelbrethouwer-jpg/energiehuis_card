# Energiehuis v1.13.1 RC — Stroomcontract kiezen en direct opslaan

## Nieuw
- Via **Kosten → Stroomvergelijker → Aanbieder uit tarievenlijst**: kies een contract uit een compacte lijst en klik **Contract opslaan**.
- Energiehuis neemt de bekende bronprijzen automatisch over en haalt de geverifieerde energiebelasting uit dezelfde openbare bron voor het huidige kalenderjaar.
- Het contract verschijnt direct in de vergelijking. Dubbel kiezen werkt het bestaande cataloguscontract bij zonder duplicaat.
- Dynamische aanbiedingen hergebruiken uitsluitend een **eerder bewust geconfigureerde kale beursprijssensor**, nooit automatisch een volledige Zonneplan-afnameprijs.
- Als een essentiële prijs of geschikte sensor ontbreekt, wordt de contractselectie wél opgeslagen maar expliciet gemarkeerd als **nog niet berekenbaar**. Geen fictieve kosten.
- Het bestaande uitgebreide contractformulier blijft bereikbaar onder **Geavanceerd**. Bestaande contracten, import/export en Vattenfall-grafieken blijven behouden.

## Betrouwbaarheid
- Tariefbron: energieprijzen-nl, inclusief `energiebelasting.json` (2026: EUR 0,110848/kWh incl. btw, mits bron de waarde geverifieerd meldt).
- De geselecteerde prijs is een **scenario met actuele tariefgegevens over historische P1-uren**, geen toezegging voor een historische factuur.
- Alle automatisch gekozen contracten worden tot het gekozen kalenderjaar beperkt: voor een volgend jaar moet opnieuw een toepasselijk scenario worden gekozen.
- Het oorspronkelijke prijsmodel verrekent afname en teruglevering apart, tenzij een contract bewust anders is ingesteld. Wettelijke saldering, welkomstbonussen, staffels en tariefwisselingen worden niet automatisch doorgerekend.
- Geen nieuwe HA-services, scripts, laadcommando's of configuratiewijzigingen.
- Bron- en contractgegevens blijven lokaal in de browser opgeslagen; automatische tariefopvraag gebruikt GET zonder credentials.

## Testcriteria
- Bestaande regressietests + nieuwe unitchecks voor automatische jaarbelasting, vaste/variabele contracten en ontbrekende velden.
- Chromium: selecteren/opslaan zonder invoerformulier, mobiel formaat, behoud geavanceerd pad, export/import en geen HA-servicecalls.
- Echte Home Assistant/iPhone-acceptatie blijft open tot na PR-CI en praktijkcontrole.

**Status: releasekandidaat in featurebranch. Niet mergen of publiceren zonder groen CI en praktijkcontrole.**
