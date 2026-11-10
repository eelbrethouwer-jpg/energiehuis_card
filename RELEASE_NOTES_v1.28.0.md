# Energiehuis v1.28.0 — Immersive Energy Home

**Release:** optionele schermvullende Live Cockpit als interactief Home in de bestaande `<energiehuis-card>`. **Standaard uit**; de huidige v1.27.0-presentatie blijft werken zonder configuratiewijziging.

## Nieuw in v1.28.0
- **Immersive Home** op basis van de exact goedgekeurde PVE-04-master; de ingeladen afbeelding blijft ongewijzigd. Dynamische energiedeeltjes volgen uitsluitend actieve, valide gemeten stroomroutes. De statische lichtlijnen in de master blijven decoratief.
- De zes onderdelen zijn klikbaar en navigeren binnen dezelfde kaart: **Cupra** (inclusief doorlink naar **Slim laden**), **Zonnepanelen**, **Huisverbruik**, **Net**, **Virtuele batterij** en **Praktijkruimte**.
- **Zonnepanelen, Huis en Net:** eigen detailpagina's met de bestaande historische grafieken en periodes. Praktijkruimte: nadrukkelijk **Nog niet gekoppeld**, geen fictieve W/kWh of dubbeltelling. Virtuele batterij blijft simulatie; niet fysiek.
- **Portret op iPhone:** volledige master over de schermbreedte bovenaan, met zes leesbare kaarten eronder; de glasvlakken in de master zijn eveneens aanklikbaar. Op desktop en tablet zweven de kaarten op de originele scène. Geen bijsnijding of vervorming van de master.
- **Inzicht → Alle metingen** blijft de oude Home-inhoud (grafiek, Energiecoach, meetwaarden) tonen. De onderste navigatie en overige Energiehuis-schermen blijven bestaan. **Terug naar Home** herstelt de vorige focus.
- **Meetbetrouwbaarheid:** de Net-detailpagina gebruikt `netPresentation()`, zodat een niet-bevestigde stroomrichting geen misleidend minteken/terugleverlabel krijgt. De ruwe P1-waarde is beschikbaar in de technische diagnose. Stale- en meetketencontroles blijven actief.

## Activering
De huidige HACS-kaart upgraden naar v1.28.0 en het bestaande Energiehuis-dashboard herladen. **Voeg uitsluitend de extra opt-in toe** aan de bestaande kaartconfiguratie:

```yaml
live_cockpit: true
live_cockpit_immersive: true
live_cockpit_image: "media-source://media_source/local/approved-visual-20261109.webp"
```

Het afbeeldingspad hierboven is het in de gebruikersinstallatie bevestigde pad voor de master rechtstreeks in **My media**. Bij een andere mediamap moet het media-ID worden aangepast. Gebruik nooit `/config/www` of `/local/` voor deze afbeelding. Bestaande sensornamen en kaartinstellingen blijven ongewijzigd.

## Behoud, veiligheid en terugdraaien
- Geen nieuwe Home Assistant-servicecalls of opslagmutaties. De Alfen-laadbediening, veiligheidsgrenzen, Active Load Balancing en 1×40 A-aansluiting blijven onaangetast.
- `live_cockpit_immersive: false` of het weglaten van de nieuwe instelling zet de huidige v1.27.0-Home-compositie terug. De gewone Live Cockpit blijft dan mogelijk met `live_cockpit: true`.
- Ontbrekende afbeelding, offline en onbetrouwbare meetwaarden geven een veilige terugval zonder fictieve live-routes.

## Teststatus en open praktijkpunten
- PR #56 visueel goedgekeurd door de eigenaar op code-HEAD `457876c11fa9684a36eedaf73cf24e626a58b380`; de goedkeuring en extra toestemming voor merge/release zijn vastgelegd in een PR-comment op 10 november 2026.
- PR #56: vijf verplichte GitHub-checks groen op de eind-HEAD, waaronder Node UTC/Europe-Amsterdam, Chromium, WebKit en pointer/touch-interactietests op meerdere schermformaten. De afzonderlijke v1.28.0-release-HEAD moet nogmaals groen worden vóór publicatie.
- **Niet praktisch getest voor v1.28.0:** echte iPhone met Companion-app (toolbar/safe-area, VoiceOver), daadwerkelijke media-authenticatie op de nieuwe compositie, en live sensorverversing/stale Alfen. De oudere v1.27.0-scène is wel werkend getoond in de eigen HA-installatie.
- De 60/90 seconden route-TTL en 10 seconden meetketensynchronisatie blijven aannames totdat werkelijke sensortijden zijn gemeten.

## Publicatiebeleid
Een merge op `main` maakt **geen** release. Publiceer alleen handmatig via `.github/workflows/publish-v1280.yml` met exacte bevestiging `PUBLISH_v1.28.0`, uitsluitend vanaf gevalideerde `main`, pas nadat alle vereiste GitHub CI groen zijn. Weiger reeds bestaande tags/releases.
