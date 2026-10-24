# Energiehuis — zelfstandige PWA, technische verkenning (v1.9.0)

## Besluit voor deze releasekandidaat
**Behoud de bestaande HACS Lovelace-kaart als productiebasis.** De nieuwe mobiele werkbalk en compacte weergave zijn onderdeel van de kaart. Een eigen PWA-shell is nog niet verantwoord zonder aparte tests van authenticatie en HA-context.

Een toegevoegd manifest maakt een Lovelace-kaart op zichzelf nog niet tot een zelfstandige app. De huidige kaart ontvangt `hass` van Home Assistant en heeft geen zelfstandige methode om ingelogde sensordata veilig te verkrijgen.

## Voorstel architectuur in fasen
1. **Nu: HACS mobile UI** — schermen en entiteiten in bestaande kaart; geen nieuwe authenticatie, geen service worker.
2. **Feasibility-spike:** zet een lokale testomgeving met HTTPS en Home Assistant op; probeer een apart startpunt op dezelfde origin. Beoordeel HA-authenticatie en websocket zonder hardcoded tokens of ongecontroleerde redirection.
3. **App-shell pas na bewijs:** eigen HTML-entrypoint, manifest met 192/512-pictogrammen, beperkte URL-scope en slechts een service worker voor versievaste statische bestanden. Verkeerd gescopeerde service workers kunnen het Home Assistant-frontend raken; registreer er **nooit één op het HA-rootpad**.
4. **Veilige migratie:** huidige HACS-kaart blijft werken; geen dubbele meting, geen gekopieerde tokens, geen historische privédata offline opslaan.

## Alternatieven
- **Eerst aan beginscherm toevoegen:** snel en onderhoudsarm, maar mogelijk Home Assistant-chrome en geen garantie op een eigen PWA-runtime.
- **Echte standalone app-shell:** beste UX op langere termijn, maar hoger auth-, onderhouds- en update-risico.
- **IFrame als tussenweg:** niet inzetten zonder testen van beveiligingsheaders, authenticatie en sessieafhandeling.

## Acceptatiecriteria PWA (allemaal verplicht)
- HA-login en sessieverloop werken veilig op iPhone, Android en extern via HTTPS.
- Geen tokens in code, LocalStorage, URL-parameters of service-worker caches.
- Unieke start-URL en manifest-scope beperken toegang tot Energiehuis.
- Offline-interface vermeldt dat gegevens verouderd kunnen zijn; nooit schijnbaar actuele meetwaarden.
- Gecachte bestanden worden bij versie-update vernieuwd zonder Home Assistant te verstoren.
- Bestaande P1, GoodWe, Alfen, Cupra, Zonneplan, gas, water, kosten en batterijfuncties blijven intact.
- Geen actieve besturingscommando's; load balancing blijft onafhankelijk functioneren.
- Handmatige testen in Safari (iPhone), Android Chrome en Home Assistant Companion App.

## Open keuzes
- Welke HTTPS/remote-accessmethode beschikbaar is (nog niet geverifieerd).
- Of een aparte same-origin route/app-shell kan draaien zonder extra backend-component.
- Welke apparaat- en browsersupport noodzakelijk is.
- Of gebruikers een PWA echt willen installeren, of liever een homescreen-snelkoppeling gebruiken.

## Technische referenties
- Home Assistant: https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/
- MDN PWA-installatie: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- MDN scope: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/scope
