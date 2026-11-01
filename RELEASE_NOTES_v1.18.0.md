# Energiehuis v1.18.0 — Batterijgrafiek in HomeWizard-stijl

## Nieuw
- Gecombineerde grafiek op de Batterij-pagina: **paarse laadenergie boven de nullijn**, **groene ontlaadenergie eronder** en **witte SOC-stippellijn** met een aparte procentas.
- Laden uit zonnepanelen en vanuit het net zijn in de paarse grafiek onderscheiden; grafiek en detailinformatie zijn toegankelijk op iPhone, tablet en desktop.
- **Dag:** gesimuleerde energie per P1-uur (kWh/uur); **Week** en **Maand:** dagtotalen van de daadwerkelijk beschikbare uren. Klik op een dag om die weer per uur te bekijken.
- **Jaar** blijft bewust uitgeschakeld zolang er maximaal 30 dagen betrouwbare uurhistorie voor de simulator worden opgehaald. Er worden geen verzonnen 5-minutenwaarden, maanden of jaren ingevuld.
- Bestaande capaciteitkeuze (5/10/15 kWh), zon-/netlaadstrategie, SOC-detailgrafiek en financiële scenario's blijven behouden.

## Belangrijke correctie
De 30-dagen-batterijsimulator was in v1.16/1.17 onbedoeld begrensd tot **400 uur** door een gedeelde grafiekhelper, terwijl 30 kalenderdagen circa 720 uur omvatten. v1.18.0 gebruikt daarom **een aparte vensterbouwer uitsluitend voor de batterij** en verwerkt ook de volledige beschikbare 30-dagenhistorie. Daarmee kunnen zowel het financiële model als de maandgrafiek een langere, correcte periode verwerken. Andere Energiehuis-grafieken blijven ongewijzigd.

## Data en veiligheid
De grafiek toont **virtuele, gesimuleerde batterijactiviteiten** uit HomeWizard/P1-uurstatistieken, **geen fysieke batterijmetingen**. De exacte laad-/ontlaadvolgorde binnen één uur is niet gemeten. De witte procentlijn is berekend uit het virtuele batterijmodel en laat geen werkelijk SOC zien. Ontbrekende meeturen zijn zichtbaar; geen nepwaarden of kunstmatige vijfminutenpunten.

Geen nieuwe Home Assistant-helpers, YAML-wijzigingen, laad-/ontlaadcommando's of wijzigingen aan Alfen Active Load Balancing. Zonneplan-historie blijft alleen bruikbaar voor de slimme modus als de historische tarieven betrouwbaar beschikbaar zijn.

## Teststatus
- Automatische Node-regressies, JavaScript-syntax en HACS-validatie.
- Chromium-tests van leveranciersvergelijker, financiële invoer en de gecombineerde dag/week/maandgrafiek.
- De tests controleren o.a. 7/30-dagen, volledige historie inclusief DST, ontbrekende P1-uren, capaciteit-/kostenberekeningen, keyboard/tap drilldown en 320/390/768/1280px.
- De publicatieworkflow draait deze controles opnieuw vóór het plaatsen van tag en release.
- **Nog niet getest op jouw fysieke iPhone met je echte Home Assistant/P1/Zonneplan-installatie.**

## HACS
Installeer **v1.18.0** zodra de release in HACS verschijnt. Herlaad daarna de Home Assistant-app en open het tabblad **Batterij**.

Meer informatie: `RELEASE_NOTES_v1.18.0_RC.md`.
