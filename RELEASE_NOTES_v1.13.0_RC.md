# v1.13.0-rc.1 — Afzonderlijke stroomvergelijker

## Gedrag
Via de nieuwe knop bovenaan **Kosten & besparing** opent een afzonderlijke stroomvergelijker. De bestaande Vattenfall 1-/3-jaarsgrafieken, kostensensoren, cumulatieve vergelijking en bediening blijven behouden.

- Maximaal 30 contracten toevoegen, bewerken en verwijderen.
- Vaste afnametarieven of historische dynamische afnameprijzen via een HA-prijssensor.
- Eén zelf in te stellen Zonneplan-referentie; geen verzonnen standaardtarieven.
- Horizontale kostenbalken met negatieve waarden, sortering en verschil met de referentie.
- Klikbare uitsplitsing in afname, terugleververgoeding, vaste leverancierskosten en terugleverkosten.
- Deze maand, dit jaar of een eigen periode, uitsluitend afgeronde dagen; maximaal 366 dagen. Tijdzone van het apparaat wordt vermeld.
- Contracten lokaal bewaren; JSON-back-up downloaden en contracten importeren/bijwerken. Geen nieuwe HA-entiteiten of besturingscommando's.

## Betekenis en grenzen
**Indicatieve leverancierskosten, geen volledige energienota of marktomvattende overstapvergelijker.**
De berekening gebruikt gemeten P1-afname en teruglevering, niet huisverbruik of een aangenomen jaarvolume. Dynamische afname wordt berekend met historische gemiddelde uurprijzen; kwartierafrekening kan afwijken. De sensor moet de volledige afnameprijs bevatten. Teruglevering heeft in deze versie een door de gebruiker opgegeven vast tarief.

Alle tarieven worden expliciet ingevuld, inclusief 0 waar kosten niet gelden. Gebruik een consistente grondslag inclusief btw/energiebelasting waar van toepassing. Geen automatische belastingberekening. Netbeheer, belastingvermindering, welkomstkortingen, staffels, dynamische terugleververgoeding en tariefwijzigingen binnen de geselecteerde periode worden niet berekend. Stel contractgeldigheid in of splits zulke perioden zelf.

Bij vaste contracten kan als scenario worden gekozen voor afzonderlijke afname/teruglevering of netto verrekening over de geselecteerde periode. Die laatste optie is geen wettelijke of contractuele vaststelling van saldering en geen jaarafrekening; de gebruiker moet de passende contractmethode controleren. Dynamische contracten ondersteunen hier alleen afzonderlijke afname/teruglevering.

Ontbreekt één P1-uur, dan worden geen contracttotalen berekend. Ontbreekt prijshistorie, dan ontbreekt het dynamische totaal en het verschil met die referentie. De ranglijst geeft alleen een volledige goedkoopste-uitkomst als alle ingevoerde contracten berekenbaar zijn. Een ontbrekende waarde wordt nooit nul.

## Opslag en veiligheid
Contracten staan in browseropslag op dezelfde Home Assistant-origin; ze zijn niet automatisch op andere apparaten beschikbaar. Maak een JSON-back-up. Geen tokens, meterhistorie, gasgegevens of besturingsopdrachten. Deze release breidt de eerdere opslagafspraak (alleen UI-voorkeur) uit met uitsluitend handmatig ingevoerde contractinstellingen. Live HA-updates vervangen geen open invoerformulier.

## Teststatus
- 79 bestaande tests als baseline geslaagd.
- 94 tests inclusief nieuwe reken-/regressietests geslaagd in Node, tijdzone Europe/Amsterdam.
- JavaScript-syntaxcontrole geslaagd.
- Lokale Chromium-browsertest geslaagd (fictieve meetdata): toevoegen/bewerken/verwijderen, Zonneplan, perioden, export/import, live formulierbehoud, terugkeer Vattenfall, 320/390/768/1280 px, nul HA-servicecalls.
- Chromium via alternatieve downloadbron beschikbaar gemaakt. Mobiele screenshot visueel gecontroleerd; geen horizontale overflow op 320/390/768/1280 px. GitHub-workflow gebruikt Ubuntu 24.04.
- Echte Home Assistant-installatie, beschikbare tariefhistorie en iPhone Companion nog niet praktisch geverifieerd.

## Release
Releasekandidaat; niet gemerged, niet gepubliceerd en niet geïnstalleerd. Eerst GitHub-controles en praktijkacceptatie; daarna een expliciete releasekeuze.
