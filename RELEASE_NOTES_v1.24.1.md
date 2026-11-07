# Energiehuis v1.24.1 – Betrouwbare laadvermogensgrenzen

Deze herstelrelease verduidelijkt de vermogensgrens bij de Alfen- en historische sessievermogensuggesties in **Cupra & Slim laden**.

- De berekende aansluitgrens wordt nu ook weergegeven wanneer de laadplanner geen geldig resultaat kan maken, bijvoorbeeld door ontbrekende of ongeldige tarieven of een verlopen vertrektijd.
- Bij minder dan **6 A** laadruimte toont de kaart de feitelijke beperking. Bij een onbekende huisbelasting staat er expliciet **“Huisbelasting onbekend (aanname 2000 W)”**.
- Beide vermogenssuggesties delen één limietmelding. Zo staat de uitleg niet dubbel in de knoppen.
- De tekst maakt onderscheid tussen de **aansluitgrens** voor hogere knopsuggesties en het **handmatig gekozen laadvermogen**. Een handmatige invoer van 3,7 kW wordt niet ten onrechte als begrensd aangeduid wanneer de grens bijvoorbeeld 4,74 kW is.
- De kaart vermeldt expliciet: **“Simulatiegrens; Alfen Active Load Balancing bepaalt het werkelijke vermogen.”**
- Aanvullende regressietests controleren huisbelasting 9000 W, ontbrekende of ongeldige tarieven, een verstreken vertrektijd, onbekende huisbelasting, dubbele limietmeldingen en handmatige invoer.

**Ongewijzigd:** `eh17Plan`, tarief- en batterijberekeningen, selectie van laaduren, `minSessions`, Home Assistant-opslag en bestaande laadbediening. De optionele laadbediening blijft standaard uit; Alfen Active Load Balancing blijft leidend. Geen nieuwe laadcommando's.

**Validatie:** de publicatieworkflow herhaalt Node-regressietests met TZ=UTC en TZ=Europe/Amsterdam, vijf Chromium-browsertests, syntax- en HACS-validatie voordat de tag wordt gepubliceerd. De exacte resultaten verschijnen bij de GitHub Actions-run.

**Bekende beperkingen:** de UI en planner hanteren dezelfde grensformule op twee plekken; toekomstige aanpassingen moeten gelijk blijven. Een negatieve of verouderde huisbelastingswaarde wordt nog niet apart geduid. De berekende grens is een indicatie voor de simulatie, geen gegarandeerd laadvermogen. Browsercontroles gebruiken fictieve sensorgegevens; live Home Assistant en fysieke iPhone zijn niet getest.

**Installatie:** werk de Energiehuis-kaart bij via HACS/Marketplace en ververs indien nodig de browser- of dashboardcache. Controleer daarna met actuele Alfen- en P1-metingen de getoonde begrenzing.
