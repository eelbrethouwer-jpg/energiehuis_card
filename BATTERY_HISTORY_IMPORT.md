# Persoonlijke historie en batterijprofielen

De tab **Vergelijken** voegt een eigen, afzonderlijke rekenbasis toe. Bestaande 7/30-dagenberekeningen, laadbediening en meetentiteiten blijven behouden.

## Gebruik
1. Open Batterij → Vergelijken.
2. Importeer de HomeWizard P1 CSV met `time`, `Import T1 kWh`, `Import T2 kWh`, `Export T1 kWh` en `Export T2 kWh`.
3. Controleer periode, resolutie, maandtotalen en energiedekking. Dagstanden tonen alleen historie; uur- en kwartierstanden maken technische replay mogelijk.
4. Open batterijgegevens. Vul de bruikbare capaciteit, afzonderlijk AC laad-/ontlaadvermogen, rondrendement en continu AC standbyverbruik per kandidaat in. Generieke 5/10/15-kWh-scenario’s zijn geen productcatalogus. 3 kW en 88% zijn expliciete startaannames; standby is onbekend tot het is ingevuld.
5. Vul optioneel eigen tarieven in voor een vast tariefscenario. Een werkelijk product kan alleen beoordeeld worden met geverifieerde productspecificaties/offerte en contractcomponenten.

Alleen batterij- en tariefinstellingen worden lokaal bewaard. De CSV en meetreeksen blijven in het geheugen van de kaart. Bij een paginaherlading moeten de meetgegevens opnieuw worden geïmporteerd. Verwijderen wist uitsluitend de geïmporteerde historie; instellingen blijven bewaard. Geen CSV-data naar GitHub of een andere server sturen.

## Parser en periode
- Ondersteunt UTF-8/BOM, komma of puntkomma, CSV-quotes en decimale komma bij puntkommaformaat.
- Verwacht chronologische Nederlandse kloklabels (Europe/Amsterdam), zoals HomeWizard ze exporteert. Geen sortering, meteromwisseling of stille tijdzone-aanname op basis van het apparaat.
- Zomertijd wordt met IANA-klokregels gecontroleerd; de twee terugkerende klokuren worden afzonderlijk aan UTC gekoppeld in volgorde van de export. Onmogelijke kloktijden of gewone duplicaten blokkeren de import.
- Een interval is het verschil tussen twee opvolgende cumulatieve T1/T2-standen, afzonderlijk gecontroleerd op teruglopen. Ontbrekende tellers, resets en grotere tijdsprongen worden niet als nulverbruik behandeld.
- Dagstanden volgen kalenderdagen van 23/24/25 uur. Deze worden nooit als verdeelde uur- of kwartierdata aan een batterijmodel aangeboden.
- Laatste begrensde jaar: twaalf kalendermaanden eindigend op de laatste beschikbare lokale middernacht. Een onvolledige laatste dag valt buiten dit jaarvenster. Bij onvoldoende beginhistorie blijft de berekening een periodescenario, zonder jaarextrapolatie.
- Maand-/jaarpercentages gebruiken de volledige kalenderduur, zodat ontbrekende begin-/einddagen zichtbaar blijven. Jaarreplay vanaf 95% dekking heet technisch jaarscenario; deze grens is een ontwerpkeuze en geen financiële betrouwbaarheidsnorm.
- Maximaal 8 MB en 150.000 meetregels. Bestand wordt één keer verwerkt; simulaties worden op bron- en instellingenversie gecachet.

## Batterijmodel
Alleen zonoverschot, zonder netladen of verschuiven van EV-sessies. AC standby is extra huisbelasting, eerst uit aanwezig exportoverschot en daarna uit batterij/net. SOC start leeg en blijft begrensd door bruikbare capaciteit. Rendement wordt symmetrisch over laden en ontladen verdeeld. Vermogenslimieten worden vermenigvuldigd met de werkelijke intervalduur.

Wanneer een interval zowel afname als teruglevering bevat, is de volgorde onbekend: er wordt alleen geladen, niet ook ontladen in dat interval. Bij een meetgat wordt SOC afgeboekt en als onbekend energieverlies gerapporteerd; geen gratis doorgifte door een gat. Eind-SOC krijgt geen geldwaarde. Energiebalans en eurovergelijking gebruiken dezelfde intervallen.

Operationeel tariefscenario = rekening zonder batterij minus rekening met batterij op basis van de expliciete vaste inkoop-/terugleveraanname. Op een begrensd jaar kan jaarlijkse onderhouds-/abonnementskost apart worden afgetrokken. Geen belastingen, saldering, staffels of tariefwijzigingen worden stilzwijgend verwerkt. Aanschafprijs staat apart; er wordt geen verwachte terugverdientijd of winnaar berekend.

## Nog nodig voor aankoopadvies
Gecontroleerde historische dynamische inkoop- en teruglevertarieven, contractregels, productspecificaties/garantie, degradatie en levensduur, vergelijking met gelijkwaardig slim Cupra-laden en technische geschiktheid/piekbelasting op de aansluiting. Uur- of kwartiergemiddelden bewijzen geen veilige zekeringbelasting. Onbalansopbrengsten zijn niet opgenomen.

## Testdekking
Zuivere functietests: CSV/tellerdelta’s, quotes, getalvalidatie, dubbele datums, zomer-/wintertijd, meterresets, hiaten, onvolledige maanden en handberekende energie-/eurobalansen. Browsercontrole: fictief volledig jaar, import/ongeldige vervanging, profiel- en tariefinstellingen, persistente instellingen zonder meetgegevens, uitklapstatus na HA-update en schermbreedtes 320/390/768/1280 px. Persoonlijke CSV’s zijn geen repositoryfixtures.
