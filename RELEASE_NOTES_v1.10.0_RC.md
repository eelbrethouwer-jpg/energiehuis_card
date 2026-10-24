# Energiehuis v1.10.0 RC — sessieherkenning en voorbereide live laadbediening

**Status: concept / draft pull request. Niet mergen of in HACS installeren voordat CI, Home Assistant-entiteiten en veiligheid zijn gecontroleerd.**

## Cupra laadgeschiedenis
- Bekijk maximaal 30 dagen detailhistorie (configureerbaar: charge_history_days 1–30).
- Kleine positieve Alfen-tellerverschillen onder 0,08 kWh worden niet langer weggegooid.
- Plausibele positieve tellerverschillen over lange intervallen worden als **Geschat** getoond, niet stilzwijgend weggegooid.
- Scheid laadperioden bij langdurige stilstand. Markeer tellerresets, onrealistische sprongen en ontbrekende data.
- Toon Alfen-meetbereik, aantal datapunten en diagnostiek.
- Minimumgrens 0,25 kWh; de indeling blijft een schatting, geen geverifieerde Alfen-transactie.
- Bij te korte Recorder-retentie zijn oude laadsessies niet met terugwerkende kracht herstelbaar.
- Ontbrekende historische Zonneplan-prijs heeft geen invloed op de sessietelling.

## Laadbediening
- Knoppen **Nu laden** en **Pauzeren** op Slim laden, met tweestapsbevestiging.
- Standaard **uitgeschakeld**. Simulatieknoppen starten geen laadactie.
- Alleen via twee expliciet gekoppelde Home Assistant-scripts, aan te roepen met script.turn_on.
- Start vereist beschikbaar script, HA-verbinding en recente P1- en Alfen-vermogensmetingen (maximaal 15 minuten).
- Pauze kan ook bij stale P1-meting, mits HA en het pauzescript beschikbaar zijn.
- Een ontvangen script-opdracht is geen bewijs dat de auto werkelijk is gestart of gestopt.
- Geen wijzigingen aan Alfen-registers, laadstroom, load balancing of Cupra-instellingen vanuit frontend.

## Optionele kaartconfiguratie

Voeg na een controle onderstaande waarden toe aan de bestaande Lovelace-kaart:

    charge_history_days: 30
    charge_control_enabled: false
    charge_start_script: script.energiehuis_start
    charge_pause_script: script.energiehuis_pause

De twee scriptnamen zijn **beoogde namen**, geen door ons aangemaakte of bevestigde scripts. HACS maakt deze scripts niet automatisch aan.

## Verplichte veiligheidstest vóór activeren

1. Inventariseer in HA Ontwikkelaarstools → Statussen welke Alfen-bedienentiteiten daadwerkelijk bestaan en bestuurbaar zijn.
2. Verifieer de technisch ondersteunde stuurmethode voor de betreffende Eve Single Pro-line (firmware en licenties). Geen onbekende Modbus-registeradressen gebruiken.
3. Bevestig dat **Active Load Balancing** leidend blijft, inclusief 1×40 A-hoofdzekering en paal/voertuiglimieten. Rekenwaarden uit de frontend zijn geen beveiliging.
4. Implementeer twee fail-safe backend-scripts/automations. Start vereist actuele meetwaarden en weigert bij ontbrekende P1-data, verbindingsproblemen of conflicterende regelingen. Pauzeren moet aantoonbaar veilig zijn.
5. Test de backend eerst vanuit HA bij live toezicht op P1, Alfen, Cupra en zekeringlimieten.
6. Controleer herstelgedrag na HA-herstart/netwerkuitval: geen onbedoelde automatische herstart.
7. Pas na bovenstaande: scripts in dashboardconfiguratie koppelen en charge_control_enabled op true zetten.
8. Test op iPhone expliciete bevestiging, blokkering bij oude sensoren en daadwerkelijke laadrespons.
9. Automatisch laden op goedkoopste volle uren is **nog niet** actief; daarvoor is aparte HA-backendlogica vereist.

## Teststatus
Nieuwe regressietests staan in tests/v110.test.cjs. Bestaande v1.7/v1.8/v1.9-tests blijven behouden. Nog geen fysieke Alfen-/Cupra-test, geen HACS-release.
