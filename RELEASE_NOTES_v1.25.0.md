# Energiehuis v1.25.0 – EnergieRegisseur Cockpit

De eerste **zichtbare stap richting EnergieRegisseur v2.0** is een compacte cockpit bovenaan het bestaande Energiehuis-overzicht. De HACS-kaart blijft Energiehuis heten; dit is **versie 1.25.0 van de kaart, niet de definitieve release van EnergieRegisseur v2.0**.

## Nieuw in deze versie
- Zes klikbare hoofdgegevens met bestaande Home Assistant-entiteiten: P1-netvermogen, GoodWe-zonproductie, huisverbruik exclusief Cupra, Cupra-accustand, Alfen-laadvermogen en de actuele Zonneplan-prijs.
- Een compacte netvermogengrafiek uit beschikbare daghistorie, met toegang tot de bestaande uitgebreide details; geen fictieve grafiek als historie ontbreekt.
- Korte vermogensbalken voor zon, huis en auto, met expliciet onderscheid tussen **actuele** en **laatst bekende** metingen. Dit is geen berekende energiebalans.
- Per bron een beschikbaarheids- en actualiteitsstatus. Bij ongewijzigde sensoren gebruikt de cockpit `last_reported` indien aanwezig en anders `last_updated` of `last_changed`. Oude, stabiele PV-0-W-, Alfen-0-W- en Cupra-SOC-waarden kunnen als **laatst bekend, met ouderdom** worden weergegeven; ze tellen dan niet mee als actuele bron.
- Klikbare detailweergave direct onder de cockpit, zodat het geopende paneel in beeld komt. Snelkoppelingen naar Slim laden, Batterij en Kosten hebben minimaal 44 px tikhoogte.
- Schermbreedtes 320, 390 en 768 px automatisch gecontroleerd zonder horizontale overflow. De bestaande meetkaarten, grafieken en tabs blijven beschikbaar.

## Technische vernieuwingen sinds v1.24.1
- Een reproduceerbare, strenger gecontroleerde HACS-build met expliciete, zelfstandige rekenmotoren voor batterijsimulatie en P1-meetkwaliteit.
- De bestaande rekenuitkomsten van deze motoren zijn bij de extractie met golden-tests en onafhankelijke differentiële controles bewaakt; geen bewust gewijzigde economische of laadberekeningen.
- Uitbreiding van Node- en Chromium-regressietests en een expliciete controle op de oorspronkelijke eerste meetkaart.

## Veiligheid en compatibiliteit
- Geen nieuwe Home Assistant-servicecalls, Alfen-laadopdrachten of opslagkeys.
- Bestaande contractvergelijking, batterijprofielen, laadplanning, prijslogica en optionele scriptbediening zijn functioneel ongewijzigd. Scriptbediening blijft standaard uitgeschakeld; Alfen Active Load Balancing en de 1×40 A-aansluiting blijven leidend.
- Geen nieuwe YAML of Home Assistant-helpers nodig om de cockpit te tonen.
- De cockpit toont metingen, **geen gegarandeerde besparing**, voorspelde laadopdracht of vervanging voor de bestaande detailanalyses.

## Validatie vóór publicatie
- Review van PR #48: onafhankelijk **GO MET OPMERKINGEN**, geen blockers.
- Op de goedgekeurde cockpit-HEAD: **352/352 Node-tests** in UTC en Europe/Amsterdam, vijf bestaande Chromium-scripts plus de cockpit-acceptatietest, en **8/8 HACS-controles** groen.
- Deze resultaten horen bij de cockpit-implementatie. De nieuwe **v1.25.0-versiecommit en uiteindelijke releasecommit** moeten afzonderlijk opnieuw worden gecontroleerd; een bestaande CI-run bewijst geen nog niet uitgevoerde releasetest.
- Openstaande acceptatie uitsluitend in de echte omgeving: `last_reported` bij gecachte sensoren en de detail-scrollpositie onder de Home Assistant-toolbar op een fysieke iPhone. De automatisering gebruikt fictieve sensorgegevens.
- Niet-blokkerende vervolgwensen: extra scheiding voor schermlezers tussen waarde en “Laatste” en eventueel grotere tekst voor het leeftijdslabel.

## Installatie en controle na publicatie
1. Update **Energiehuis** via HACS (aangepaste Dashboard-repository). Controleer dat de nieuwe versie `v1.25.0` beschikbaar is voordat je bijwerkt.
2. Herlaad het Lovelace-dashboard en ververs indien nodig de browser-/appcache. De resource blijft `/hacsfiles/energiehuis-card/energiehuis-card.js`.
3. Controleer dat het overzicht bovenaan **“Jouw energie, nu”** toont en dat de kaartvoet `v1.25.0` vermeldt.
4. Vergelijk de zes KPI's met de daadwerkelijke P1-, GoodWe-, Alfen-, Cupra- en Zonneplan-entiteiten. Test ook PV `0 W` 's nachts en Alfen `0 W` in idle, met aandacht voor de bronstatus.
5. Open op de iPhone via de cockpit een net-, zon- of huisdetail. Controleer dat het paneel zichtbaar is onder de HA-toolbar, ook na een hertekening of scroll.
6. Controleer de bestaande secties Slim laden, Batterij, Kosten, contracten en eventuele optionele laadbediening zonder automatische wijzigingen.

**Releaseproces:** deze tekst is een voorbereiding. Een draft-PR of merge van de versiecode publiceert **geen** tag/release. Publicatie vereist een afzonderlijke, handmatig bevestigde GitHub Actions-run ná een expliciet gebruikersakkoord.
