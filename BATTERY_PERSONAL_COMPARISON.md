# Persoonlijke batterijvergelijker — ontwerp en acceptatie

Status: ontwerp plus eerste meetbasis in de interface. Geen volledige vergelijker of release.
Broncodebasis: main e8922d5 (v1.21.2). Werkelijke HA-installatie onbekend.

## Doel en grenzen
Bepaal voor dit huishouden of investeren zinvol is en welk product financieel en technisch past. Rangschik op netto contante waarde en totale kosten, met eenvoudige terugverdientijd als aanvullende maat. Geen winnaar wanneer de data of productspecificaties onvoldoende zijn. Gebruik geen algemeen jaarverbruik of marketingopbrengsten als persoonlijke meetdata.

## Pagina en bediening
1. Compact adviesblok: beste passende kandidaat of reden waarom advies ontbreekt; periode, betrouwbaarheid en belangrijkste beperking direct zichtbaar.
2. Meetbasis: P1-afname en teruglevering, PV, Alfen, tariefdekking, hiaten, seizoenen. Per bron entiteit, eenheid, herkomst en controle-uitkomst. Netafname is geen bruto huisverbruik.
3. Vergelijking: maximaal drie gekozen producten naast geen batterij. Mobiel kaarten met dezelfde velden, desktop tabel. Bruikbare kWh, laad-/ontlaad-kW, investering, jaarlijkse netto besparing, terugverdientijd, resultaat over 10/15 jaar. Onbekend blijft onbekend.
4. Klikbare historie: import/export vóór en na batterij, laden uit zon/net, ontladen, SOC, prijzen en verliezen. Vandaag en toekomstige verwachting gescheiden van historische resultaten.
5. Geldstromen: vermeden inkoop minus netladen, gemiste teruglevering, gewijzigde contractkosten, onderhoud en abonnement. Investering afzonderlijk. Jaarlijkse kasstromen inclusief degradatie, vervanging en eventuele restwaarde expliciet instelbaar.
6. Instellingen achter uitklappers: bronkoppeling, producten/offertes, scenario’s en berekening. Bewaar open toestand bij HA-updates. Instellingen exporteerbaar; geen HA-tokens of meetreeksen in browseropslag.

## Datamodel en kwaliteit
Intervallen in UTC met expliciet einde; weergave Europe/Amsterdam. Ondersteun kwartierdata en uurdata zonder schijnprecisie. Verbruik en tarieven op gelijke intervallen met energiebehoud. Zomer-/wintertijd inclusief 23/25-uursdagen testen. Cumulatieve meters verwerken met resetdetectie en eenhedencontrole.

Meetdekking = geldige unieke intervalduur / gevraagde periode. Ook geheel ontbrekende rijen tellen als gat. Prijsdekking afzonderlijk rapporteren. Duplicaten, overlap, negatieve energiewaarden en sprongen markeren; niet als nul behandelen. Ontbrekende data niet stilzwijgend interpoleren. Start-/eind-SOC en verlies bij gaten afzonderlijk boeken.

Voorgestelde adviesgrens (ontwerpkeuze, geen bewezen statistische norm): minstens 12 aaneengesloten maanden, 95% energiedekking én 95% tariefdekking, alle seizoenen aanwezig. Volledige dekking alleen is onvoldoende; metergrenzen en contract moeten ook bevestigd zijn. Kortere perioden geven uitsluitend periode-uitkomsten. Eventuele jaarreconstructie gebruikt zichtbare scenario’s en onzekerheid, geen vermenigvuldiging van één zonnige maand.

P1 bevat de bestaande Cupra-afname al. PV-opwek is alleen nodig voor bruto huisverbruik en gewijzigde zonnelaadscenario’s; noem gemeten export geen totale productie. Alfen-energie dient ter uitsplitsing en sessiereconstructie. Cupra-SOC is aanvullend, geen vervanging voor gemeten laadenergie.

## Eerlijke referenties
A: huidig gemeten gedrag zonder thuisbatterij.
B: slim Cupra-laden zonder thuisbatterij.
C: dezelfde slimme Cupra-planning met kandidaatbatterij.
Rapporteer C−B als extra batterijvoordeel en B−A als autolaadvoordeel. Bij ontbrekende aankomst/vertrek- of sessiegegevens uitsluitend A vergelijken met ongewijzigd EV-profiel; geen verzonnen laadflexibiliteit. EV-energie en vertrekeis in B en C exact gelijk. Optionele EV-flexibiliteit is een gelabelde gebruikersaanname.

## Rekenmotor
Losse modules: normalisatie, tariefberekening, batterijmodel, EV-planning, dispatch, kasstromen en rangschikking. Zuivere functies; versie van model en invoer herleidbaar. Hergebruik huidige grafieken waar mogelijk. Lange reeksen buiten de renderlus verwerken, resultaten cachen op invoerversie; voorkom meerdere simultane Recorder-verzoeken.

Energiebalans per interval: huis + EV + batterijladen + export + expliciete verliezen = PV + import + batterijontladen. Grenzen: bruikbare SOC, afzonderlijke AC laad-/ontlaadlimieten, rendement, standby en degradatie. Geen gelijktijdig laden en ontladen. Geen gratis beginenergie of kunstmatige winst door eindsaldo; gelijke eindconditie of zichtbare waardecorrectie.

Dispatch mag alleen informatie gebruiken die destijds beschikbaar was. Perfecte voorkennis apart als bovengrens tonen, nooit als verwachte opbrengst. Productgebonden EMS-beperkingen, exporttoestemming en abonnementen meenemen. Onbalanshandel is een afzonderlijk onzeker scenario en wordt niet automatisch opgeteld bij zelfverbruik/arbitrage.

1×40 A als bekende aansluiting opnemen; nominale spanning en beschikbare marge expliciet als rekeninvoer. Begrens extra netladen op totale huisaansluitingsruimte, met prioriteit voor huishoudelijke belasting en EV-vertrekeis. Uurgemiddelden zijn geen bewijs dat zekering of load balancing veilig is; technische geschiktheid vraagt fijnmaziger metingen en installateurcontrole.

## Tarieven en producten
Historische prijs per interval: beurs, opslag, belasting, btw en teruglevercomponent apart vastleggen. Contractwissels dateren. Saldering op toepasselijke afrekenperiode, terugleverkosten op werkelijke tariefstructuur; vaste kosten alleen als verschil tussen scenario’s. Wettelijke en fiscale scenario’s pas implementeren na verificatie bij actuele primaire bronnen. Btw-teruggave/subsidie alleen met expliciete toepasselijkheid.

Productcatalogus: fabrikant/model, bron-URL, controledatum, nominale/bruikbare kWh, AC-vermogen, rendement met meetdefinitie, standby, omvormer, fase/aansluiting, installatie, abonnement, garantiejaar/doorzet/restcapaciteit, uitbreidbaarheid en EMS-compatibiliteit. Onbekende waarden blokkeren een definitieve rangschikking. Prijs uit eigen offerte heeft voorrang boven openbare indicatie. Geen ongecontroleerde standaardmerken of prijzen.

## Financieel model
Toon historische periodebesparing afzonderlijk van toekomstscenario’s. Jaarlijks netto resultaat = verschil in volledige elektriciteitsrekening minus extra exploitatiekosten. Degradatie beïnvloedt capaciteit/energie in volgende jaren. Voorkom dubbele afschrijving door niet zowel volledige aanschaf als dezelfde slijtagekosten als kasuitgave te tellen.

Eenvoudige terugverdientijd: eerste kruising van cumulatieve netto kasstromen met investering; vermeld wanneer geen kruising binnen levensduur. Netto contante waarde met zichtbare discontovoet. Toon conservatief, basis en gunstig scenario met verklaarde invoerverschillen, geen verzonnen betrouwbaarheidsinterval. Rangschik uitsluitend technisch geschikte producten op identieke perioden, contracten en strategieën. Duurdere/grotere batterij kan slechter zijn; geen batterij kan winnaar zijn.

## Acceptatie en bouwvolgorde
1. Huidige stap: zichtbare meetbasis en ontwerp. Bestaande simulaties blijven periode-indicaties.
2. Normalisatie en bronaudit: hiaten, duplicaten, DST, eenheden, meterresets en synchronisatie; export van geanonimiseerde controletotalen mogelijk.
3. Product/offerte-invoer met brondata, validatie en blijvend opslaan van uitsluitend instellingen.
4. Tarieven en intervalreplay over seizoenen, daarna gelijke EV-referenties en vermogensgrenzen.
5. Kasstromen en rangschikking, onzekerheidsscenario’s, interactieve productvergelijking.
6. Browsercontrole 320/390/768/1280 px; toetsenbord, uitklapstatus en HA-updates; regressies op Cupra, laden, kosten en huidige batterijgrafiek.
7. Praktijkacceptatie met eigen HA-data: P1-dagtotalen en Alfen-sessies reconciliëren; één handmatig narekenbare dag en één factuurperiode. Pas daarna persoonlijk advies en release.

Verplichte rekentests: geen zon; vlakke prijs; negatieve prijzen; alleen export; minimaal batterijverlies; volle/lege batterij; hoge huisbelasting; EV-sessie 30–40 kWh over meerdere uren; geen dubbele EV-winst; gaten/overlap/DST; ontbrekende tarieven; onvoordelige batterij; meerkosten grotere batterij; geen terugverdienen; gelijke begin/eind-SOC; geen voorkennis in uitvoerbare strategie. Test energie- en eurobalans op onafhankelijke handberekeningen.

## Nog onbekend
Werkelijke Recorder-historielengte, exacte sensorkoppelingen en metergrenzen, zonnepanelenhistorie, Alfen-sessiedekking, contractcomponenten, offertes en installatiebeperkingen. Geen toegang tot de live HA-instance in deze taak. Deze gegevens zo veel mogelijk via een bronaudit ophalen; alleen resterende essentiële keuzes aan gebruiker vragen.

## Validatie eerste stap — 5 november 2026
- JavaScript syntax en whitespacecontrole geslaagd.
- Vier nieuwe tests geslaagd: ontbrekende intervallen/duplicaten, ongeldige waarden/prijzen, lege invoer en 25 verstreken uren bij wintertijd.
- Volledige suite: 166/176 geslaagd. Dezelfde tien bestaande financiële/grafiekasserties falen ook op ongewijzigde main (nieuwe tests daarbij buiten beschouwing). Geen nieuwe falende bestaande tests waargenomen.
- Browsercontrole niet uitgevoerd: Chromium kon in deze omgeving niet starten door geweigerde socket-operatie. Responsieve weergave en HA-praktijkacceptatie blijven open.
- Geen productcatalogus, jaarmodel, aankoopadvies, merge of release in deze eerste stap.
