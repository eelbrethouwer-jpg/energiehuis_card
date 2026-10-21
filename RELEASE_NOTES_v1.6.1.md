# Energiehuis v1.6.1 — Cupra & Slim laden

Deze onderhoudsrelease maakt de belangrijkste laadfuncties direct bereikbaar via een extra tabblad onderaan het Energiehuis-dashboard.

## Nieuw: apart tabblad **Cupra & Slim laden**

- Een zesde navigatieknop onderaan: **Cupra & Slim laden** (op kleine telefoons: **Slim laden**).
- De laadpagina begint direct met de **actuele Alfen-laadstatus** (vermogen, stroom L1 en Cupra-SOC).
- Daaronder blijven **Jouw laadscenario**, **Planningsmodus** en **Verwachte laadplanning** beschikbaar, met Zonneplan-kwartierprijzen, goedkoopste en duurste kwartier, kosteninschatting en ingeplande uren.
- **Cupra** bevat voortaan de voertuigstatus, voertuigdetails en **Cupra Insights**, waaronder gereden kilometers, geschat praktijkverbruik, actieradius en temperatuuranalyse.
- Wisselen tussen tabbladen behoudt je ingestelde simulatiegegevens zolang de kaart open blijft.

## Gebruik en veiligheid

- Alle bestaande pagina’s (Overzicht, Batterij, Kosten, Meer) blijven behouden.
- Geen wijzigingen aan de Home Assistant-entiteiten, Zonneplan-berekeningen, Alfen-configuratie of laadlimieten.
- De laadplanner blijft een **simulatie**: er worden geen laadcommando’s verzonden; Alfen Active Load Balancing blijft leidend.
- Home Assistant-frontendcache na HACS-update zo nodig verversen.

## Installatie

Update na publicatie van de GitHub Release via HACS naar **v1.6.1**. Er zijn geen YAML- of backendwijzigingen nodig.
