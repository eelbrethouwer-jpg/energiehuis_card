# Energiehuis v1.21.2 — Cupra Insights: volledige historische analyse

## Verbeterd
- **Temperatuuranalyse onafhankelijk van periodefilter.** De knoppen Vandaag, Deze week, Deze maand en Dit jaar filteren alleen de kilometerweergave; praktijkactieradius, kWh/100 km, Cupra-vergelijking, temperatuurklassen en klimaatcorrelaties gebruiken alle in Home Assistant Recorder nog beschikbare geldige ritsegmenten.
- **Historische laadmeting** gebruikt dezelfde periode-onafhankelijke detailhistorie en herkent thuislaadintervallen via Alfen/Cupra.
- **Sneller wisselen tussen perioden** door gedeelde historische cache; geen herhaalde grote detailhistorie-query binnen de ingestelde verversperiode.
- **Datakwaliteit** sluit rit- en laadintervallen uit die door meer dan 48 uur ontbrekende meetgegevens zijn gescheiden.
- In de Cupra Insights-interface staat expliciet wat de periodefilter bepaalt en wat uit historische data wordt berekend. De datadekking toont ook het jaar.

## Gelijk gebleven
- Overzicht en kilometerdiagrammen met Vandaag/Week/Maand/Jaar.
- Stabiliteitsfix voor uitklapbare Cupra- en batterijpanelen uit v1.21.1.
- Stroomvergelijker, batterijgrafieken en bestaande dashboards.
- Alfen load balancing, laadbeveiliging en standaard uitgeschakelde optionele laadsturing.

## Databron en beperkingen
- Historische analyse begint niet bij de geselecteerde periode maar vraagt Recorder-detailhistorie op vanaf 2020. **De kaart kan uitsluitend historie gebruiken die Recorder daadwerkelijk nog heeft.**
- Home Assistant Recorder bewaart detailhistorie standaard 10 dagen, tenzij anders geconfigureerd. Oude gewiste ritsegmenten worden niet hersteld. Voor een meerjarig zelflerend model is afzonderlijke persistente segmentopslag nodig.
- De lange historiequery kan op grote Recorder-databases extra verwerkingstijd en geheugengebruik vragen; in deze release beperken caching en hergebruik van de data het aantal requests.

## Validatie
- Nieuwe regressietests controleren alle-periode-analyse, verschillen in kilometerfilters, caching, meetgaten en perioden-onafhankelijke Recorder-query.
- GitHub CI: JavaScript-syntax, Node-tests, HACS metadata en Chromium browser-regressie moeten succesvol zijn vóór publicatie.
