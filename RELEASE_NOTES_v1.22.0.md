# Energiehuis v1.22.0 – Batterijvergelijker op jouw jaarverbruik

Nieuwe tab **Batterij → Vergelijken**:
- Importeer een HomeWizard P1 CSV met cumulatieve T1/T2-meterstanden.
- Bekijk jouw maand- en jaarprofielen met netafname, teruglevering en meetdekking.
- Vergelijk drie aanpasbare batterijprofielen op dezelfde uur- of kwartierhistorie, met eigen bruikbare capaciteit, AC laad-/ontlaadvermogen, rendement en standbyverbruik.
- Vul optioneel een vaste inkoop-/terugleveraanname, installatieofferte en jaarlijkse vaste kosten in voor een transparant tariefscenario.

De parser verwerkt Nederlandse zomer-/wintertijd, tellerresets, hiaten en ongeldige meterstanden. Dagstanden tonen alleen het stroomprofiel en worden nooit omgezet naar verzonnen uurdata. De simulatie gebruikt alleen zonneladen en laat gemeten EV-afname ongewijzigd. Gerichte invoer blijft behouden bij dashboardupdates.

**Gebruik:** update via HACS, vernieuw het dashboard en open Batterij → Vergelijken. Importeer je CSV en controleer periode en dekking. Vul de technische profielgegevens in; onbekend standbyverbruik blokkeert de berekening totdat je bewust een waarde invult. 3 kW en 88% zijn zichtbare startaannames voor de generieke scenario’s, geen productspecificaties.

**Privacy:** CSV en meetreeksen blijven alleen in het geheugen van het tabblad en moeten na herladen opnieuw worden geïmporteerd. Alleen batterij- en tariefinstellingen worden lokaal bewaard. Persoonlijke meetgegevens staan niet in de repository.

**Validatie:** 193 Node-tests, HACS-/syntaxcontrole en Chromium-controles op leverancierspagina, bestaande batterijpagina en nieuwe vergelijker. Browsercontrole omvat import, fouten, invoerfocus, instellingen bewaren, historie verwijderen, uitklapstatus en 320/390/768/1280 px. De publicatieworkflow herhaalt deze controles vóór publicatie.

**Grenzen:** nog geen persoonlijk aankoopadvies of verwachte terugverdientijd. Historische dynamische tarieven, contractregels, degradatie/levensduur, een gelijkwaardig slim-Cupra-alternatief en technische piekbelasting moeten daarvoor nog worden toegevoegd. Productgegevens en offertes vul je zelf in; er is nog geen gecontroleerde productcatalogus. Live Home Assistant- en iPhone-praktijkacceptatie blijven open.
