# HA-01 — Home Assistant-datacontract en beeldroute (LIVE-cockpit, alleen-lezen)

**Status:** gebouwd en automatisch getest met **gesimuleerde** Home Assistant-states. **Niet praktisch getest:** er is geen echte Home Assistant-verbinding gemaakt (dat vraagt aparte toestemming). Alles staat in `preview/pve-04/`; de productiekaart is ongewijzigd.

## 1. Wat de LIVE-kaart van Home Assistant gebruikt

| Frontendcontract | Gebruik | Nooit |
|---|---|---|
| `setConfig(config)` | Zelfde sleutels als de productiekaart; onbekende sleutels worden genegeerd | Configuratie wijzigen of opslaan |
| `set hass(hass)` → `hass.states[entity_id]`, `hass.connected` | Lezen; per frame samengevoegd; alleen bij een gewijzigd state-object of een gewijzigde verbinding opnieuw rekenen | Eigen tokens, REST, polling, `subscribe_events` |
| `hass.callWS({ type: 'media_source/resolve_media', media_content_id })` | Alleen voor de beeld-URL (alleen-lezen WS-opdracht, geen servicecall) | `callService`, `auth/sign_path`, schrijfacties |

Elementnaam: `energiehuis-live-cockpit-preview` (los van de productiekaart `energiehuis-card`). Er is **geen** registratie als dashboardkaart (`window.customCards`) en geen resource-installatie.

## 2. Bronnen (`ha/contract.js`)

Standaard-entiteiten en sleutels zijn **exact** die van de productiekaart (`EH_DEFAULTS` in `src/legacy/00-foundation.js` en de README); een test controleert dat. De TTL's volgen de v1.25-EnergieRegisseur-cockpit (`src/legacy/16-regisseur-cockpit.js`).

| Bron | Sleutel | Standaardentiteit | Soort / eenheid | Teken | TTL | Laatste stand | In code | In echte HA |
|---|---|---|---|---|---|---|---|---|
| P1-netvermogen | `net` | `sensor.p1_meter_vermogen` | vermogen W/kW | + = afname, − = teruglevering (`p1_sign`) | 5 min | nee | ✔ productie | **onbevestigd** |
| GoodWe PV | `zonnepanelen` | `sensor.goodwe_pv_power` | vermogen W/kW | ≥ 0 | 35 min | ja, alleen bij 0 W | ✔ | **onbevestigd** |
| Huis excl. auto | `huis` | `sensor.energiehuis_huisverbruik_exclusief_auto` | vermogen W/kW | ≥ 0 (< −50 W ongeldig) | 5 min | nee | ✔ | **onbevestigd** (template-definitie niet in repo) |
| Alfen laden | `laden` | `sensor.alfen_actief_vermogen_totaal` | vermogen W/kW | ≥ 0 (< −30 W of > 11,5 kW ongeldig) | 35 min | ja, alleen bij 0 W | ✔ | **onbevestigd** |
| Cupra-SOC | `cupra` | `sensor.garage_cupra_born_accuniveau` | % (0–100) | — | 90 min | ja | ✔ | **onbevestigd** |
| Virtuele batterij | `batterij` | `sensor.virtuele_batterij_soc` | % (0–100), **SIMULATIE** | — | 90 min¹ | ja | ✔ | **onbevestigd** |
| Praktijkruimte | `praktijk` | — | toekomstige submeter | — | — | — | — | **niet gekoppeld**² |

¹ Niet in de productie-cockpit; gelijkgesteld aan de Cupra-SOC.
² In HA-01 bewust niet koppelbaar: een ingevulde `praktijk` wordt genegeerd (met melding) tot een aparte opdracht.

Extra sleutels:
- `p1_sign`: `import_positive` (standaard) of `export_positive`.
- `image`: alleen `media-source://media_source/…` (webp/jpg/png, geen `..`).
- `asset_base`: alleen voor de preview.

**Huisverbruik exclusief auto.** De productie omschrijft de waarde als netafname − teruglevering + zonopwek − autoladen (`02-card-shell.js`). De echte HA-template staat niet in de repository en is dus onbevestigd. De integriteitscontrole van het model (net + zon − Cupra wijkt meer dan 150 W af van de huissensor ⇒ "Controle nodig", alle routes stil) vangt een afwijkende definitie of een omgekeerde P1 op.

## 3. Eenheden en teken

- **Vermogen:** `W` wordt ongewijzigd overgenomen, `kW` × 1000; decimale komma wordt geaccepteerd.
  - Een **ontbrekende of andere eenheid** (`Wh`, `A`, …) maakt de meting **ongeldig** en zichtbaar ("Onbekende eenheid …" / "Eenheid ontbreekt").
  - *Afwijking van productie:* `ehW()` neemt bij een ontbrekende eenheid W aan. LIVE is bewust strenger.
- **Percentage:** alleen eenheid `%` en een waarde van 0–100.
- **Toestanden:** `unknown`, `unavailable`, `none`, leeg of niet-numeriek ⇒ "Geen geldige waarde".
- **Ontbrekende entiteit** ⇒ "Entiteit niet gevonden", nooit 0.
- **Netrichting:**
  - afname vanaf +80 W, teruglevering vanaf −80 W, onder 40 W in balans; daartussen een dode band zonder tijdsvertraging;
  - *afwijking van de productie-cockpit:* die gebruikt ±50 W;
  - richting, pijl, kaartkleur en lichtpunten worden alleen getoond bij een **actieve** netroute; anders "Richting niet bevestigd".

## 4. Versheid (brongebonden, geen schijnactualiteit)

1. **Tijdstempel:** de meest recente geldige bron-tijdstempel van het state-object: `last_reported` ≥ `last_updated` ≥ `last_changed`.
   - Er wordt **nooit** een eigen tijdstempel gemaakt, ook niet bij een ongewijzigde waarde.
   - Geen of een ongeldige tijdstempel, of meer dan 120 s in de toekomst ⇒ "Tijdstempel onbekend" (niet actueel).
2. **Leeftijd > TTL** ⇒ niet actueel: route uit, lichtpunten stoppen direct.
   - **Stabiele bronnen** (PV en Alfen op 0 W, Cupra-SOC, virtuele batterij) tonen dan de **laatste stand** met "Laatste stand · 3 uur · niet recent bevestigd" (oranje rand). Dat is nooit een route en telt nooit als actueel.
   - Andere bronnen tonen "—" met "Verouderd · 20 min".
3. **Zonder nieuwe HA-update** wordt opnieuw beoordeeld door één timer op de eerstvolgende TTL-grens (maximaal elke 60 s, voor de leeftijdslabels). De timer wordt gestopt bij het ontkoppelen.
4. **`last_reported`:** sinds HA 2024.3 een eigenschap van het state-object (wordt bijgewerkt bij elke statusmelding, ook zonder wijziging). **Niet bevestigd** is of de Lovelace-frontend dit veld in `hass.states` doorgeeft.
   - Zonder `last_reported` geldt `last_updated`. Een P1 die meer dan 5 min exact gelijk blijft, wordt dan eerlijk "Verouderd" (getest: constant zonder `last_reported` ⇒ verouderd, met recente `last_reported` ⇒ actueel).
5. **Werkelijke verversfrequentie:** onbevestigd. Meetplan voor de afzonderlijk goed te keuren HA-test:
   - per bron gedurende 30 min de intervallen van `last_updated` en `last_reported` loggen (alleen-lezen, in de browserconsole van de preview);
   - de TTL's alleen bijstellen als de gemeten p99-intervallen daar dichtbij komen.

## 5. Afgeschermde beeldroute (Media Source)

| Onderdeel | Uitvoering |
|---|---|
| Configuratie | `image: media-source://media_source/local/energiehuis/<bestand>.webp`. Het bestand staat in de HA-mediamap, **niet** in `/config/www` (dat is publiek via `/local/`) en niet in GitHub. |
| Ophalen | `hass.callWS({ type: 'media_source/resolve_media', media_content_id })` geeft een tijdelijk getekende URL (`/media/local/…?authSig=…`), daarna via `hass.hassUrl()`. |
| Validatie | Alleen een same-origin pad onder `/media/` wordt geaccepteerd (geen externe URL, geen `/local/`, geen `..`). |
| Verlopen | Lukt het laden niet (bijv. verlopen handtekening of een HA-herstart), dan wordt **één keer** opnieuw opgelost. Daarna volgt de veilige terugval: alleen de interface (lijstweergave), met melding; de data werkt gewoon door. |
| Geen beeld geconfigureerd | Terugval "Geen beeld geconfigureerd — alleen interface", zonder enig `/media`-verzoek. |
| Na het laden | Het beeld blijft in het `<img>`-element. Herladen of opnieuw opbouwen lost opnieuw op (getekende URL's gelden alleen voor het eerste verzoek). |

**Getest (gesimuleerd, `tools/serve-ha-preview.cjs`):**
- de master komt alleen via een getekende URL; zonder handtekening 401, met een vervalste handtekening 403;
- een verlopen handtekening geeft 2 resolves en daarna de terugval;
- het openbare repositorypad wordt niet gebruikt.

**BLOCKER voor definitieve acceptatie van stap 4:** de **echte** authenticatie kan zonder Home Assistant niet worden geverifieerd. Het gaat om de werkelijke vorm van de `authSig`-URL, de verloopduur (niet gedocumenteerd voor `resolve_media`; `auth/sign_path` gebruikt standaard 30 s), het gedrag bij een HA-herstart en de Companion-apps.

Tot een goedgekeurde HA-test blijft de terugval actief. Er is geen vaste `/media`-URL als oplossing gebruikt.

## 6. Privacy- en compatibiliteitsbeoordeling van de master

| Aspect | Beoordeling |
|---|---|
| Huidige openbaarheid | De master (`preview/pve-03/reference/approved-visual-20261109.webp`, SHA-256 `932d0e74…7ee6`) staat **al openbaar** in de repository (PVE-03-referentie). Een afgeschermde HA-route beschermt dus alleen de HA-kopie, niet de GitHub-kopie. Verwijderen uit de openbare geschiedenis is een aparte beslissing van de eigenaar (herschrijven van de geschiedenis; buiten HA-01). |
| Inhoud | Een ontwerpbeeld uit de ChatGPT-ontwerpchat (geen foto volgens `APPROVED_VISUAL_REFERENCE.md`). Geen personen, geen adres of huisnummer, geen echt kenteken ("CUPRA BORN" is een merktekst). Wel het Cupra-merklogo (privégebruik geaccepteerd). Restrisico: als de woning op de echte woning lijkt, is herkenning denkbaar ⇒ **laag tot middel**. |
| HA-opslag | In de mediamap (geauthenticeerd via Media Source), niet in `/config/www`. Geen nieuw privébeeld in GitHub. Het originele PNG blijft privé. |
| Compatibiliteit | WebP (176 KB, 1330 × 748) werkt in HA-frontend-browsers en in de Companion-apps (Android-WebView/Chromium, iOS-WKWebView ≥ 14). Getekende URL's werken in `<img src>` zonder headers. Bemonsteren van randkleuren vraagt same-origin; `/media` is same-origin (ook via Nabu Casa). Op grote schermen met DPR 2 is het beeld iets zacht (1×-bron). |

## 7. Bekende verschillen met de productiekaart (bewust)

| Punt | Productie | LIVE-preview |
|---|---|---|
| Ontbrekende eenheid | W aangenomen | ongeldig |
| Netrichting | ±50 W | 80/40 W met dode band |
| TTL, tijdstempelvolgorde, laatste stand | — | gelijk aan de v1.25-cockpit; alleen stabiele 0 W en SOC |

## 8. Open punten

1. Echte HA-test (aparte toestemming): bestaan, eenheden en verversfrequentie van alle entiteiten; `last_reported` in `hass.states`; de Media Source-route (authenticatie, verloopduur, herstart, iOS/Android).
2. De definitie van de huisverbruik-template vastleggen.
3. Besluit van de eigenaar over de openbare GitHub-kopie van de master.
