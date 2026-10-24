# Energiehuis v1.9.0 – Standalone PWA Edition (roadmap)

**Stand 24 oktober 2026:** de eerste mobiele Lovelace-releasekandidaat v1.9.0-rc.1 is op een aparte branch gebouwd. **De zelfstandige PWA is nog niet geïmplementeerd.** Zie [technische verkenning](PWA_SPIKE_v1.9.0.md) en [release notes](RELEASE_NOTES_v1.9.0_RC1.md).

Doel: Energiehuis op iPhone en Android laten aanvoelen als een eigen installeerbare app.

## Gewenste eigenschappen
- Een eigen appnaam, icoon, startscherm en standalone presentatie.
- Geschikt voor het beginscherm op iPhone en Android.
- Mobiele bottom-navigatie zonder overbodige Home Assistant-app-omgeving.
- HTTPS en veilige Home Assistant-authenticatie zonder hardcoded tokens.
- Duidelijke offline-indicatie; verouderde energiegegevens worden niet als live getoond.
- Alle bestaande Energiehuis-functionaliteit blijven behouden.

## Technische keuze vóór ontwikkeling
1. Test hosting op dezelfde HTTPS-origin als Home Assistant.
2. Controleer hoe de huidige Lovelace-card zijn HA-context ontvangt buiten Lovelace.
3. Vergelijk een eigen geïnstalleerd dashboard met een zelfstandige app-shell.
4. Onderzoek secure auth, bediening op afstand, caching en app-updates.
5. Cache uitsluitend appbestanden; geen gevoelige tokens of live sensordata.
6. Test iOS Safari en Android Chrome met en zonder netwerkverbinding.

Een standaard snelkoppeling naar een Lovelace-dashboard is nog geen zelfstandige PWA. We kiezen de architectuur voor v1.9.0 nadat v1.8.0 is getest en goedgekeurd.
