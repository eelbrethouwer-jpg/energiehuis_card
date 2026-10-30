# v1.13.0-rc.2 — Aanbieders uit tarievenlijst en dynamische teruglevering

Via **Kosten → Stroomvergelijker → Aanbieder uit tarievenlijst** open je een aparte, compacte tarievenpagina. De bestaande Vattenfall 1-/3-jaarsgrafieken blijven behouden.

## Functies
- Open tarieven van energieprijzen-nl ophalen bij openen/vernieuwen, zonder account of offerteaanvraag; filter vast/dynamisch.
- Bronlink, controledatum per bedrag, opmerkingen en oorspronkelijke waarden bekijken. Een ontbrekende of meer dan 30 dagen oude controledatum krijgt ‘controle nodig’. De bronstatus is geen onafhankelijke verificatie door Energiehuis.
- ‘Controleren & toevoegen’ vult een conceptcontract. Energiebelasting, ontbrekende bedragen, passende verrekenmethode en periode moeten worden gecontroleerd; bronbevestiging is verplicht vóór opslaan.
- Vaste tarieven uit de bron worden als levering inclusief btw, exclusief energiebelasting behandeld. Belasting wordt expliciet ingevuld en eenmaal opgeteld.
- Dynamisch: kale beursprijssensor inclusief btw, plus expliciete belasting en leveranciersopslag. Teruglevering kan dezelfde beursprijs plus een positieve/negatieve correctie gebruiken. Inhouding wordt niet automatisch nogmaals als extra terugleverkosten toegepast.
- Oude contracten met een volledige afnameprijssensor en vaste terugleververgoeding blijven werken.
- Maandelijkse leverancierskosten worden naar rato van kalenderdagen verdeeld, ook bij schrikkeljaar en zomer-/wintertijd.
- Broninformatie blijft bij opgeslagen contracten en JSON-export/import bewaard. Vernieuwen overschrijft nooit opgeslagen contracten.
- Netwerk-/schemafouten laten opgeslagen contracten en een eerder opgehaalde lijst beschikbaar; geen verzonnen vervangende tarieven.

## Grenzen en gebruik
De bron is een onafhankelijke open dataset, geen complete overstapmarkt. De gelezen dataset bevatte 21 dynamische en 21 vaste aanbiedingen; de aantallen kunnen veranderen. Modelcontracten zijn herkenbaar; geen actieprijzen of bonussen. Sommige bronwaarden hebben opmerkingen over andere ingangsdata: de gebruiker moet die per bedrag controleren, niet alleen de generatiedatum van het bestand.

Deze uitbreiding **installeert geen beursprijssensor** en haalt geen historische marktprijzen bij EnergyZero op. Voor dynamische contracten uit de lijst moet je een bestaande HA-sensor met kale marktprijs inclusief btw koppelen. Een volledige Zonneplan-afnameprijs is daarvoor ongeschikt (anders tel je belasting/opslag dubbel). Zonder voldoende prijshistorie ontbreekt het dynamische totaal.

Een huidige aanbieding op oud gemeten verbruik toepassen is een **scenario**, geen bewijs van wat toen factureerbaar was. De prijsgrondslag wordt expliciet gekozen. Eén handmatig belastingbedrag wordt niet over meerdere kalenderjaren toegepast; splits zulke perioden. Uurmiddelden zijn indicatief bij kwartierafrekening. Staffels, welkomstkortingen, tariefwijzigingen, bijzondere teruglevervoorwaarden, netbeheer, belastingvermindering en wettelijke/contractuele saldering worden niet automatisch afgeleid. Gebruik waar nodig een persoonlijk aanbod en controleer de verrekenmethode.

## Bronnen en privacy
Alleen GET-verzoeken naar twee vaste raw-GitHub-bestanden, zonder credentials. Geen offerte-API's, leverancieraanmeldingen, tokens, accountgegevens of meetgeschiedenis verstuurd. Tarievenbron: [energieprijzen-nl](https://github.com/zhinees/energieprijzen-nl), data onder [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.nl); onderliggende leveranciersbronnen staan per tarief. Geen datasetbundel in deze repository.

## Validatie
- 94 bestaande tests als baseline groen.
- 108 tests groen, inclusief prijscomponenten, bronvalidatie, ontbrekende gegevens, negatieve marktprijzen/terugleveropbrengsten, maandkosten en netwerkfouten.
- Chromium met fictieve meet-/tariefdata: oorspronkelijke bediening, catalogus ophalen/filteren, vast/dynamisch concept, verplichte bevestiging, opslaan, terugkeer, export/import, netwerkfout en formulierbreedtes 320/390/768/1280 px geslaagd. Geen HA-servicecalls.
- Adapter gecontroleerd tegen de daadwerkelijk gelezen externe bestanden; ontbrekende datums/kosten zichtbaar.
- Lokale directe browserfetch naar raw GitHub geblokkeerd door de uitvoeromgeving; GitHub-live-endpoint/CORS-test geslaagd met 42 aanbiedingen. HACS-, regressie- en browserworkflow groen op de eerste kandidaatcommit; laatste correctie krijgt opnieuw CI.
- Eigen HA-/iPhone-praktijktest, beschikbare kale beursprijssensor en bijbehorende meetdekking nog open.

Releasekandidaat op basis van main na merge van PR #19. Geen publicatie of installatie uitgevoerd.
