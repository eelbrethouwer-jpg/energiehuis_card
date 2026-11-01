# Energiehuis v1.21.1 — Uitklapbare panelen blijven open

## Opgelost
- Het paneel **Investering, slijtage en berekeningsdetails** op Batterij bleef na het aanklikken niet open wanneer Home Assistant een update verzond. De kaart herbouwt bij iedere render zijn HTML; de open/dicht-status van native `<details>` ging daarbij verloren.
- Open/dicht-statussen worden nu **alleen in het geheugen van de kaart** per pagina en paneel bewaard en na het opnieuw renderen teruggezet. Ook bewust gesloten panelen blijven gesloten.
- Dit geldt ook voor batterij-historie, datakwaliteit, SOC-details en uitlegpanelen van de stroomvergelijker.
- De reeds bestaande Cupra-knop **Uitgebreide voertuigdetails** werkt met een aparte statusvariabele en blijft onaangetast. Een nieuwe Chromium-regressietest valideert expliciet openen, live update, behouden en sluiten.

## Technisch
- Alleen frontend-statebehoud in de bestaande Lovelace-kaart, zonder Home Assistant-/Alfen-schrijfacties of extra netwerkverzoeken.
- Geen wijzigingen in batterijberekening, Cupra/Alfen-functies, tarieven, contractopslag of dashboards.
- Panel-identiteit gebruikt pagina, CSS-klasse, samenvatting of contractnaam; dubbele panelen krijgen een volgnummer.
- Nieuw: `tests/v1211-expansion-state.test.cjs` en uitgebreid `tests/browser/battery-finance.cjs`.

## Controle
- Automatisch: syntax, alle Node-regressies, HACS-validatie en Chromium (incl. mobiele breedtes, batterij, Cupra en stroomvergelijker).
- Releaseworkflow herhaalt die checks op de **merge-commit** alvorens tag v1.21.1 te publiceren.
- **Nog nodig voor definitieve gebruikersacceptatie:** test op de echte iPhone in HA Companion met live Cupra- en P1-updates.

## Installatie
Installeer v1.21.1 in HACS en herlaad Home Assistant. Open Batterij → Rendement → Investering, slijtage en berekeningsdetails; controleer of dit geopend blijft bij het bijwerken van de sensoren. Herhaal bij Cupra → Uitgebreide voertuigdetails.
