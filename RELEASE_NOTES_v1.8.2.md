# Energiehuis v1.8.2 — Virtuele-batterij knoppen herstellen

## Opgelost
- De 5, 10 en 15 kWh-knoppen op de pagina **Batterij** reageren weer en markeren direct de geselecteerde capaciteit.
- De capaciteitsvergelijking gebruikt meteen de gekozen grootte in de indicatieve maandberekening.
- De eventafhandeling voor het bestaande geavanceerde meterbeheer is eveneens correct gekoppeld bij het renderen van de kaart.
- Nieuwe regressietest controleert het wisselen tussen 5, 10 en 15 kWh.

## Installatie
1. Merge eerst de fix-pull-request nadat alle GitHub Actions geslaagd zijn.
2. Publiceer daarna de nieuwe GitHub-release met tag `v1.8.2` op de actuele main-commit.
3. Werk via HACS Energiehuis bij en herlaad Home Assistant of de dashboardpagina; wis bij een oude weergave de browsercache.
4. Controleer onderaan de kaart of `v1.8.2` zichtbaar is en test alle drie de knoppen.

Deze wijziging past uitsluitend het dashboard aan. Geen batterij- of laadpaalaanpassing en geen actieve laadcommando's. De batterijbusinesscase blijft een *simulatie*.
