# ⚡ Energiehuis v1.8.0 – Energy Insights & Cost Control

**Releasekandidaat in ontwikkelbranch. Niet als HACS-release gepubliceerd.**

Energiehuis v1.8.0 bouwt verder op v1.7.1 en behoudt alle bestaande Home Assistant-entiteiten, Cupra Insights, batterijfuncties, geschiedenis, zes navigatietabbladen en de dubbel bevestigde nulmetingfunctie.

## 🔥 Gas Insights
- Interactieve gasgrafieken voor vandaag, gisteren, 7 dagen, 30 dagen, dit jaar en vorig jaar.
- Gebruik van de bestaande gasmeter en gasdagsensor.
- Controle op meeteenheden en onvolledige Recorder-data.
- Engie-kosten blijven optioneel.

## 💶 Kosten & Besparing 2.0
- Extra kostenpaneel met stroomkosten, beschikbare gasgegevens en budgetdoel van €200.
- Contractgrens 1 november 2026 zichtbaar: cijfers daarvoor mogen niet als gerealiseerde Zonneplan-facturen gelden.
- Vattenfall 1-/3-jaarsvergelijkingen, historiegrafieken, bestaande maandprognose en batterijberekeningen blijven beschikbaar.
- Afzonderlijke vermelding van meetwaarden, voorspellingen en hypothetische besparingen.

## 🚗 Slim laden 2.1
- Detailtabel met goedkoopste geldige volledige klokuren.
- Gewenste/haalbare kWh, verwachte kosten, resterende energie en waarschuwingen voor vertrektijd.
- Hergebruik van veilige v1.7.1-planningsmotor met 1×40 A, maximaal 32 A laadpaal, ingestelde reserve, huisverbruik, rendement en prijsdata.
- Tijdzone bij geplande uren rond overgang zomer-/wintertijd.
- Geen laadcommando's; Alfen Active Load Balancing blijft leidend.

## ☀️ Zonne-energie Insights
- Interactieve GoodWe-/P1-perioden, productie, import, export en afgeleid direct zelfverbruik.
- Ontbrekende of tegenstrijdige energiegegevens blijven onbekend.
- Cupra-zonneaandeel wordt niet als directe meting gepresenteerd zonder betrouwbare synchronisatie.

## 📱 Mobiele interface
- Compactere KPI-kaarten, minder witruimte en kleinere schermindeling.
- Bestaande navigatie en grafieken blijven bestaan.

## 🛡️ Systeemcontrole
- Extra controle voor gas-, zonne-opwek-, import- en exportsensoren.
- Waarschuwingen bij onjuiste eenheden en ontbrekende meetgegevens.
- Indicatieve vermogensbalans P1, GoodWe, Alfen en woning.
- Nog niet gekoppelde HomeWizard-watermeter is geen storing.

## 🧪 Teststatus
- Automatische syntax-, regressie- en HACS-manifestcontrole via GitHub Actions in ontwikkelbranch.
- Nog testen met echte Home Assistant-Recorder-historie en op mobiele apparaten voordat publicatie mogelijk is.

## 🔒 Veiligheid en compatibiliteit
- Lovelace-resource en bestaande kaartconfiguraties ongewijzigd.
- Geen nieuwe fysieke reset- of laadcommando's.
- De bestaande nulmetinghelper behoudt dubbele bevestiging.
- De watermeterkoppeling en zelfstandige PWA volgen in toekomstige versies.

**Status: geen release of tag aangemaakt, geen merge naar main en geen HACS-update uitgevoerd.**
