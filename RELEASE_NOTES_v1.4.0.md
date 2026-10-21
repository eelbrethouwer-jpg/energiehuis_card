# Energiehuis v1.4.0 — release candidate

## Hoofdpunten

### Uitgebreid algemeen overzicht
- Gas toegevoegd aan Home.
- Water toegevoegd aan Home.
- Echte Cupra SOC is de standaardbron.
- Virtuele batterij SOC is standaard gekoppeld.
- Ontbrekende water/dag-entiteiten tonen geen verzonnen waarden.

### Nieuwe interne pagina: Batterij
- Kosten zonder batterij.
- Kosten met batterij.
- Netto batterijbesparing.
- Besparing vandaag, deze maand en dit jaar.
- Vermeden inkoop.
- Kosten netladen.
- Gemiste terugleveropbrengst.
- Contractvoordeel blijft bewust buiten de batterijbusinesscase.

### Nieuwe interne pagina: Kosten
- Actuele Zonneplan-prijs.
- Zonneplan dag/maand/jaar.
- Vattenfall 1 jaar en 3 jaar als vaste referenties.
- Voordeel versus de Vattenfall-referenties.
- Besparing door slimme timing.
- Duidelijke waarschuwing tegen dubbeltelling.

### Nieuwe interne pagina: Meer
- Gasoverzicht.
- Wateroverzicht.
- Status van optionele dag- en live-waterentiteiten.

### Navigatie
Alle vijf knoppen zijn nu intern bruikbaar:
- Overzicht
- Cupra
- Batterij
- Kosten
- Meer

### Cupra voertuigdashboard
- Compacte voertuigstatus bovenaan het Cupra-tabblad.
- Accupercentage, actieradius, laadstatus en resterende laadtijd in één oogopslag.
- Uitklapbare **Uitgebreide voertuigdetails** met ruimte voor kilometerstand, vergrendeling, portieren, laadkabel, laadvermogen, geladen energie, laadsnelheid, laadscenario, laadschema, portalfeed en verbinding.
- Ontbrekende Cupra-data wordt niet verzonnen; velden blijven leeg totdat de bijbehorende entiteit is gekoppeld.
- Auto-detectie op Cupra friendly names toegevoegd voor o.a. Actieradius, Kilometerstand, Deuren vergrendeld, Buitentemperatuur, Doeltemperatuur, Klimaatverbruik, Laaddoel, Laadschema, Status portaalfeed en Verbruik boordnet.
- Compacte Cupra-tegels tonen voortaan Accu, Actieradius, Vergrendeling en Buitentemperatuur; laadgegevens blijven beschikbaar in de uitgebreide sectie.

## Veiligheid
Deze release blijft **alleen-lezen voor laadsturing**. De Cupra-planner simuleert laadmomenten, maar verstuurt geen commando's naar de Alfen. De bestaande Home Assistant EMS en Active Load Balancing blijven leidend.

## Nog voor publicatie controleren
- Visuele controle op iPhone.
- Visuele controle op desktop.
- Controleren welke echte HomeWizard-waterentiteiten gebruikt moeten worden.
- Controleren welke kosten-/batterijsensoren in de actieve Home Assistant-configuratie exact aanwezig zijn.
- Daarna pas tag/release `v1.4.0` publiceren zodat HACS hem aanbiedt.
