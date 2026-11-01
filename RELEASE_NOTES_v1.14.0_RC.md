# Energiehuis v1.14.0 RC — Jouw voordeel met Zonneplan

## Nieuwe functie
Binnen **Kosten → Stroomvergelijker** verschijnt een compact overzicht **Jouw voordeel of nadeel** boven de bestaande, uitklapbare contractresultaten:
- De berekende Zonneplan-kosten voor de gekozen periode.
- Per extra contract het berekende totaal en hoeveel euro Zonneplan **voordeliger** of **duurder** was geweest.
- Verschillen zijn in het groen bij een voordeliger Zonneplan-referentie, in rood bij een duurder Zonneplan-scenario; de tekst benoemt dit ook (kleur is niet de enige indicator).
- Bij gelijke kosten verschijnt *Even duur*.
- Bij een ontbrekende referentie, incomplete P1-uren of ontbrekende tariefgeschiedenis wordt **geen fictief verschil** getoond; de app legt uit waarom.

De bestaande periodeknoppen **Deze maand**, **Dit jaar** en **Eigen periode** sturen de samenvatting én de bestaande resultaten aan. De bestaande Vattenfall 1-/3-jaarsgrafieken veranderen niet.

## Methodiek en grenzen
Het verschil is steeds: **berekende kosten extra contract − berekende kosten referentie**, berekend op dezelfde volledige reeks P1-uren. Een positief verschil betekent dat de referentie goedkoper zou zijn geweest, negatief betekent dat het extra contract goedkoper zou zijn geweest. Alleen **afgeronde dagen** en complete historische uren worden vergeleken.

Dit is een **indicatieve terugblik**, geen bewijs van een gerealiseerde contractbesparing of definitieve afrekening. Andere contracttarieven worden als scenario over de gekozen historische verbruiksuren gelegd; daadwerkelijke contractstart, kwartierafrekening, saldering, bonussen, staffels, netto-/leverancierskosten en belastingwijzigingen kunnen invloed hebben. **Voor historische tijdvakken voor de start van Zonneplan op 1 november 2026 kunnen vergelijkingen niet als gerealiseerde Zonneplan-kosten worden uitgelegd**.

## Scope en regressierisico
- Alleen frontend-HTML, CSS en read-only vergelijking op bestaande resultaten.
- Geen Home Assistant-servicecalls, YAML, P1-configuratie, Zonneplan-aansturing, laadcommando's of wijziging in de opslagstructuur.
- Bestaande contractbeheer, import/export en Vattenfall-resultaten ongewijzigd.

## Tests en acceptatie
- Unitchecks: positieve, negatieve en gelijke verschillen, ontbrekende referentie, incomplete prijshistorie en ongeldige contractperiode, HTML-escaping.
- Chromium: vergelijkingsbedragen bij een fictief vast contract en Zonneplan-referentie, wijziging van positief naar negatief verschil, viewport-controle 320/390/768/1280 px, geen HA-servicecalls.
- CI-uitkomst vaststellen vóór merge en release.
- Echte Home Assistant-/iPhone-praktijkacceptatie nog open.

**Status: releasekandidaat (nog niet geïnstalleerd/gepubliceerd).** Definitieve release pas na groene CI en expliciete merge/publicatie van tag `v1.14.0`.
