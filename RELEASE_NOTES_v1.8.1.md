# ⚡ Energiehuis v1.8.1 – Energy Insights & Cost Control (Herstelrelease)

**Herstelt de onjuiste code-inhoud van de gepubliceerde v1.8.0-tag.**

## Waarom v1.8.1?
De GitHub-release v1.8.0 van 22 oktober 2026 wees per ongeluk naar dezelfde broncode als v1.7.1. Hierdoor kregen gebruikers via HACS wel de versienaam v1.8.0, maar niet de zes nieuwe Energiehuis-functies. Deze herstelrelease bevat de daadwerkelijke v1.8.0-implementatie en verhoogt het versienummer in het JavaScript naar **1.8.1**. De bestaande v1.7.1- en v1.8.0-tags blijven ongewijzigd.

## 🔥 Gas Insights
- Historische grafieken voor vandaag, gisteren, 7 dagen, 30 dagen, dit jaar en vorig jaar.
- Bestaande gasmeter- en dagsensoren blijven gekoppeld.
- Duidelijke melding bij ontbrekende Recorder-historie.

## 💶 Kosten & Besparing 2.0
- Extra kosteninzicht met het budgetdoel van €200 per maand.
- Herkenning van de start van Zonneplan op 1 november 2026.
- Bestaande Vattenfall-1- en 3-jaarsreferenties blijven beschikbaar.
- Geen optelling van losse vergelijkingsvoordelen als gerealiseerde besparing.
- Gas/Engie wordt niet als volledig meegenomen wanneer kostengegevens ontbreken.

## 🚗 Slim laden 2.1
- Overzicht van geselecteerde goedkoopste volledige toekomstige klokuren.
- Weergave van behoefte, planbare energie, prijs en resterende kWh vóór vertrek.
- Rekening met éénfase 40 A, maximaal 32 A voor Alfen, reserve, woningverbruik en rendement.
- Onderscheid tussen dubbele uren rond de wintertijdwisseling.
- **Geen aansturing van Alfen of Cupra**: laadadvies is een simulatie; Active Load Balancing blijft leidend.

## ☀️ Zonne-energie Insights
- GoodWe-/P1-overzichten met periodefilters.
- Opwek, afname, teruglevering en berekend direct zelfverbruik.
- Geen verzonnen meetwaarden bij onvolledige of tegenstrijdige statistieken.

## 📱 Compactere mobiele interface
- Compactere KPI-kaarten en minder witruimte op smalle schermen.
- Bestaande tabs en navigatie blijven werken.

## 🛡️ Systeemcontrole
- Extra checks op bronbeschikbaarheid, eenheden en vermogensbalans.
- De later aan te sluiten HomeWizard-watermeter is geen systeemstoring.

## ✅ Compatibiliteit en tests
- Bestaande Energyhuis Lovelace-kaartnaam en HACS resource blijven intact.
- Bestaande functies uit v1.7.1 inclusief Cupra Insights, batterij en meterbeheer blijven behouden.
- Automatische Node-tests, JS-syntax en HACS-manifestvalidatie moeten slagen voor publicatie.
- Controle met echte Home Assistant-gegevens en mobiel blijft nodig voordat definitief wordt vrijgegeven.

## 🔄 HACS installeren na publicatie
1. Open HACS → Energiehuis.
2. Kies versie **v1.8.1** zodra deze als release beschikbaar is.
3. Herlaad de dashboardpagina (zo nodig cache verversen).
4. Controleer of **Gas Insights**, **Zonne-energie Insights** en **Slim laden 2.1** zichtbaar zijn.

**Deze release notes zijn voorbereid op de herstelbranch; er is nog geen v1.8.1 GitHub-release of tag gepubliceerd.**
