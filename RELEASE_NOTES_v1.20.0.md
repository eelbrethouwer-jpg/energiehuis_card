# Energiehuis v1.20.0 — Batterij Vandaag, Historie en Rendement

## Nieuwe mobiele batterijpagina
- Drie compacte tabs: **Vandaag** (standaard), **Historie** en **Rendement**. De gekozen virtuele batterij (5/10/15 kWh) en laadstrategie blijven bovenaan bereikbaar.
- Bovenaan drie historische KPI's. Deze zijn **geen live batterijmetingen**.
- **Vandaag:** grafiek met **alleen daadwerkelijk beschikbare toekomstige Zonneplan-uur- of kwartiertarieven**, maximaal 24 uur vooruit. De bestaande prijsparser en kwartier→uur-aggregatie worden hergebruikt; voor een uur worden kwartierprijzen alleen geaggregeerd als alle vier echte kwartieren beschikbaar zijn.
- De groen gemarkeerde uren zijn de goedkoopste **beschikbare** prijsuren, rekening houdend met de gekozen batterijcapaciteit en het gesimuleerde maximale laadvermogen. Als de tarieven niet volledig zijn, staat dat expliciet bij de grafiek.
- In de strategie **Zon + goedkoop netladen** toont de witte stippellijn een **hypothetisch laadscenario** dat bewust bij 0% start, zonder PV-, huishoudelijk verbruik of ontladen. Dit is geen voorspelling van de werkelijke batterij-SOC, geen gegarandeerde optimale arbitrage en geen laadcommando. Bij **Alleen zonne-overschot** worden geen netlading of fictieve SOC getoond.
- Zonder 3 toekomstige uurprijzen: expliciete melding, geen verzonnen grafiek.

## Functies die behouden blijven
- HomeWizard-stijl historische laad-/ontlaadgrafiek met dag/week/maand en uur-/dagdrilldown onder **Historie**.
- Rendement inclusief 7/30 dagen, investering/slijtage, vergelijkende capaciteitstabel, historische SOC en datakwaliteitscontrole onder **Rendement**.
- Oude 10-kWh-/dagtotalenberekeningen in aparte uitklapbare sectie; alle andere Energiehuis-tabbladen ongewijzigd.
- Geen extra YAML, Home Assistant-entiteiten, schrijftoegang, auto-aansturing, Alfen-servicecalls of wijziging aan Active Load Balancing.

## Bewuste beperkingen en vervolg
- **Geen volledige echte toekomstprognose** zolang geen betrouwbare recente batterijtelemetrie, uurlijkse PV- en woningverbruiksvoorspelling aanwezig zijn. De grafiek is uitsluitend een scenario op basis van bekende toekomstige prijzen.
- Vijfminuten-P1 bestaat volgens de gebruikerssteekproef alleen aantoonbaar voor één dag (288/288); de bestaande historische grafiek blijft per uur en jaar blijft uitgeschakeld.
- Home Assistant/Zonneplan op de echte iPhone is nog niet praktijktestbaar vanuit GitHub.
- **Aannames:** batterij begint hypothetisch leeg en er is geen ontladen tijdens het voorbeeld; rendementsverliezen op basis van bestaande 88%-config; prijsselectie is de goedkoopste beschikbare uren en geen volledig economisch dispatch-algoritme.

## Controle en publicatie
- Vier PR-controles (JS/HACS, alle Node-regressies, bestaande frontendtest en Chromium-tests) waren groen voor de releasevoorbereiding. De definitieve GitHub-publicatieworkflow draait JavaScript-, Node-, HACS- en beide Chromium-tests **opnieuw op de merge-commit**, vóór tag en release worden aangemaakt.
- Regressies voor stroomvergelijker, batterij, navigatie, prijsdekking en mobiele schermbreedtes 320/390/768/1280 px zijn meegenomen.
- Tests gebruiken gesimuleerde Home Assistant-gegevens. **De echte iPhone-installatie, P1-Recorder en toekomstige Zonneplan-prijzen kunnen alleen lokaal worden geaccepteerd.**
- Nooit energie-, SOC- of PV-voorspellingen verzinnen. Historische 5-minuten-/jaarweergave blijft uitgeschakeld tot voldoende echte dekking is aangetoond.

## Installeren
1. In Home Assistant: HACS → Energiehuis → update naar **v1.20.0** zodra deze verschijnt.
2. Herlaad de Home Assistant Companion-app; controleer de secties **Batterij → Vandaag / Historie / Rendement**.
3. Kijk bij Vandaag of Zonneplan toekomstige prijzen aanbiedt; zonder toekomstige prijzen verschijnt een waarschuwing in plaats van een voorspelde grafiek.

Deze release regelt **geen** laadbesturing en is **geen** fysiek gemeten thuisbatterij.
