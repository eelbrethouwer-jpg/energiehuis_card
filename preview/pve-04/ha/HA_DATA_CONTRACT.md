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

Standaard-entiteiten en sleutels zijn **exact** die van de productiekaart (`EH_DEFAULTS` in `src/legacy/00-foundation.js` en de README); een test controleert dat.

**Twee versheidsgrenzen per bron (RC1-A).**
- **Toon-TTL** — hoe lang een waarde zichtbaar mag blijven. Volgt de v1.25-EnergieRegisseur-cockpit (`src/legacy/16-regisseur-cockpit.js`, getest tegen de broncode). De productie gebruikt deze grenzen alleen voor tegels en balkjes ("Geen energiebalans"), **niet** voor een live animatie. De 35 min voor GoodWe/Alfen is daarom bewust **niet** overgenomen als grens voor bewegende lichtpunten.
- **Route-TTL** — hoe recent een vermogensmeting bevestigd moet zijn voor een actieve route, bewegende lichtpunten, een netrichting en de balanscontrole. Conservatieve standaard zolang de werkelijke updatefrequenties niet in Home Assistant zijn gemeten; per bron instelbaar (`route_ttl_s`).

| Bron | Sleutel | Standaardentiteit | Soort / eenheid | Teken | Toon-TTL | Route-TTL | Laatste stand | In code | In echte HA |
|---|---|---|---|---|---|---|---|---|---|
| P1-netvermogen | `net` | `sensor.p1_meter_vermogen` | vermogen W/kW | + = afname, − = teruglevering (`p1_sign`) | 5 min | **60 s** | nee | ✔ productie | **onbevestigd** |
| GoodWe PV | `zonnepanelen` | `sensor.goodwe_pv_power` | vermogen W/kW | ≥ 0 | 35 min | **90 s** | ja, alleen bij 0 W | ✔ | **onbevestigd** |
| Huis excl. auto | `huis` | `sensor.energiehuis_huisverbruik_exclusief_auto` | vermogen W/kW | ≥ 0 (< −50 W ongeldig) | 5 min | **60 s** | nee | ✔ | **onbevestigd** (template-definitie niet in repo) |
| Alfen laden | `laden` | `sensor.alfen_actief_vermogen_totaal` | vermogen W/kW | ≥ 0 (< −30 W of > 11,5 kW ongeldig) | 35 min | **90 s** | ja, alleen bij 0 W | ✔ | **onbevestigd** |
| Cupra-SOC | `cupra` | `sensor.garage_cupra_born_accuniveau` | % (0–100) | — | 90 min | — (geen route) | ja | ✔ | **onbevestigd** |
| Virtuele batterij | `batterij` | `sensor.virtuele_batterij_soc` | % (0–100), **SIMULATIE** | — | 90 min¹ | — (geen route) | ja | ✔ | **onbevestigd** |
| Praktijkruimte | `praktijk` | — | toekomstige submeter | — | — | — | — | — | **niet gekoppeld**² |

¹ Niet in de productie-cockpit; gelijkgesteld aan de Cupra-SOC.
² In HA-01 bewust niet koppelbaar: een ingevulde `praktijk` wordt genegeerd (met melding) tot een aparte opdracht.

Extra sleutels:
- `p1_sign`: `import_positive` (standaard) of `export_positive`.
- `image`: alleen `media-source://media_source/…` (webp/jpg/png, geen `..`).
- `asset_base`: alleen voor de preview.
- `route_ttl_s` (RC1-A): `{ net, zonnepanelen, huis, laden: seconden }`, elk 5 s tot de toon-TTL van die bron (nooit langer). Voorbeeld na meting: `route_ttl_s: { zonnepanelen: 45 }`.
- `balance_max_skew_s` (RC1-B): maximale spreiding van de vier bron-tijdstempels voor een "synchrone" balans, 1–120 s, standaard **10 s**.

**Huisverbruik exclusief auto.** De productie omschrijft de waarde als netafname − teruglevering + zonopwek − autoladen (`02-card-shell.js`). De echte HA-template staat niet in de repository en is dus onbevestigd. De integriteitscontrole van het model (net + zon − Cupra wijkt meer dan 150 W af van de huissensor) vangt een afwijkende definitie of een omgekeerde P1 op — sinds RC1-B alleen als **kritiek** bij een synchroon gemeten keten (§4b).

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
  - richting, pijl, kaartkleur en lichtpunten worden alleen getoond bij een **actieve** netroute.
  - **RC2 — geen onbevestigde richting:** is er een actuele P1-waarde maar staat de netroute stil (meetketen tegenstrijdig of niet synchroon), dan toont de Net-kaart het **absolute** vermogen zonder minteken of pijl, met de chip "P1-meting" en de regel "Richting niet bevestigd" (in de compacte mobiele weergave, waar de subregel verborgen is, de chip "P1 · richting onbevestigd") en een neutrale grijze kaartkleur; de reden (tegenstrijdig / niet synchroon) staat in het detailpaneel en de statusregel; schermlezers horen "P1-meting · richting niet bevestigd (…)". Een vertraagde P1 toont eveneens alleen de grootte. Het detailpaneel behoudt voor diagnose de **ruwe ondertekende sensortekst** (zoals de bron die meldt, vóór de tekenconfiguratie), de tijdstempel(bron) en de P1-tekenconfiguratie. De sensorwaarde en de P1-berekening veranderen niet; zodra de netroute weer actief is, verschijnen teken, pijl en kleur weer.

## 4. Versheid (brongebonden, geen schijnactualiteit)

1. **Tijdstempel:** de meest recente geldige bron-tijdstempel van het state-object: `last_reported` ≥ `last_updated` ≥ `last_changed`.
   - **RC2:** dit is het tijdstip van de **HA-statusmelding**, **geen bewezen fysieke meettijd** in de meter of omvormer. Tussen meting en melding zitten polling, buffering en integratievertraging die per integratie verschillen en onbekend zijn. "Actueel" en "synchroon" betekenen in deze preview dus: recent resp. gelijktijdig **gemeld** door Home Assistant.
   - Er wordt **nooit** een eigen tijdstempel gemaakt, ook niet bij een ongewijzigde waarde.
   - Geen of een ongeldige tijdstempel, of meer dan 120 s in de toekomst ⇒ "Tijdstempel onbekend" (niet actueel).
2. **Leeftijd ≤ route-TTL** ⇒ actueel ("live"): telt mee voor routes, lichtpunten, netrichting en balans.
3. **Route-TTL < leeftijd ≤ toon-TTL** ⇒ **vertraagd** (RC1-A): de laatst bevestigde waarde blijft zichtbaar met "Niet live · bevestigd 10 min geleden" (oranje rand), maar er is **geen** route, geen lichtpunt, geen netrichting (P1: alleen de grootte, zonder teken of pijl) en geen "Laden". Status: "3/5 meetwaarden actueel · 2 vertraagd"; de samenvatting noemt de vertraagde bronnen.
4. **Leeftijd > toon-TTL** ⇒ niet actueel: route uit, lichtpunten stoppen direct.
   - **Stabiele bronnen** (PV en Alfen op 0 W, Cupra-SOC, virtuele batterij) tonen dan de **laatste stand** met "Laatste stand · 3 uur · niet recent bevestigd" (oranje rand). Dat is nooit een route en telt nooit als actueel.
   - Andere bronnen tonen "—" met "Verouderd · 20 min".
5. **Zonder nieuwe HA-update** wordt opnieuw beoordeeld door één timer op de eerstvolgende route- óf toon-TTL-grens (maximaal elke 60 s, voor de leeftijdslabels). Zo stoppen lichtpunten op de route-grens zonder nieuwe HA-update (getest). De timer wordt gestopt bij het ontkoppelen.
6. **`last_reported`:** sinds HA 2024.3 een eigenschap van het state-object (wordt bijgewerkt bij elke statusmelding, ook zonder wijziging). **Niet bevestigd** is of de Lovelace-frontend dit veld in `hass.states` doorgeeft.
   - Zonder `last_reported` geldt `last_updated`. Een P1 die meer dan 5 min exact gelijk blijft, wordt dan eerlijk "Verouderd" (getest: constant zonder `last_reported` ⇒ verouderd, met recente `last_reported` ⇒ actueel).
7. **Werkelijke verversfrequentie:** onbevestigd. Meetplan voor de afzonderlijk goed te keuren HA-test:
   - per bron gedurende 30 min (overdag mét zon en tijdens een laadsessie, en 's nachts) de intervallen van `last_updated` en `last_reported` loggen (alleen-lezen, in de browserconsole van de preview);
   - per bron `route_ttl_s` op ongeveer 2–3 × het gemeten p99-interval zetten, nooit boven de toon-TTL;
   - `balance_max_skew_s` op het gemeten p99-verschil tussen P1, GoodWe, Alfen en de huistemplate binnen één update;
   - zonder `last_reported` in `hass.states` worden constante waarden snel "vertraagd": dat is de veilige kant (geen beweging), geen fout.

**Getest (Node, `tests/ha-freshness-sync.test.cjs`, en browser, `tests/ha-live.cjs`):** actieve PV- en Alfen-meting 2, 5, 10, 20 en 35 min niet bevestigd met recente P1 ⇒ geen zon-/laadroute en geen lichtpunten, waarde zichtbaar als "niet live", netroute op basis van P1 blijft; 36 min ⇒ "—"; route-grens zonder nieuwe update; instelbaarheid en validatie van `route_ttl_s`.

## 4b. Asynchrone meetketen (RC1-B)

> **Benadering (RC2).** De synchroniciteit hieronder gaat over de tijdstempels van HA-bronmeldingen, niet over bewezen gelijktijdige fysieke metingen. Ze blijft een benadering totdat echte HA-data is onderzocht (meetplan §4.7). De waarden **10 s** (`balance_max_skew_s`), **2 s** (huismarge) en de route-TTL's **60/90 s** zijn **voorlopige configuratiewaarden**, geen meetresultaten (`C.PROVISIONAL` in `contract.js`).

De balanscontrole vergelijkt net + zon − Cupra met de huissensor. Een verschil > 150 W is pas een **echte tegenstrijdigheid** als de keten voldoende synchroon is gemeten:

| Voorwaarde | Standaard |
|---|---|
| Alle vier (P1, PV, Alfen, huis) actueel binnen hun route-TTL | ja |
| Spreiding tussen de oudste en nieuwste bron-tijdstempel | ≤ 10 s (`balance_max_skew_s`) |
| Huissensor niet ouder dan de nieuwste invoermeting (de huiswaarde is afgeleid en moet die wijziging al verwerkt hebben) | marge 2 s |

| Uitkomst | Balans | Routes | Status | Melding |
|---|---|---|---|---|
| Synchroon, ≤ 150 W | `sluit` (geen bewijs dat de keten klopt) | normaal | `n/5 meetwaarden actueel` | — |
| Synchroon, > 150 W | `wijkt af` | **alle stil** | **Controle nodig** (rood) | kritiek — bestaande fail-safe ongewijzigd |
| Niet synchroon, ≤ 150 W | `niet vergelijkbaar` | normaal: elke route rust op een eigen actuele meter | ongewijzigd | — (detailpaneel: "niet als bevestiging te gebruiken") |
| Niet synchroon, > 150 W | `niet vergelijkbaar` | **alle gepauzeerd** — welke meting achterloopt is niet te bepalen, dus geen onbewezen stroomrichting | **Meetketen niet synchroon** (oranje) | niet-kritiek (oranje melding) |

Vertraagde of laatst bekende waarden (§4) doen mee om een afwijking zichtbaar te maken, maar leveren nooit `sluit` of een kritieke melding op. De negatieve huissensor blijft altijd kritiek.

**Getest:** synchrone tegenstrijdigheid (ook bij 9 s spreiding en bij alle bronnen 30 s oud) ⇒ kritiek; dezelfde afwijking met 30–85 s spreiding ⇒ niet kritiek, gepauzeerd; grens 10,0 / 10,5 s en instelbaar; updatevolgorde "P1 springt, huis volgt 4–6 s later" ⇒ eerst gepauzeerd, daarna weer sluitend zonder "Controle nodig"; huis ná de invoer bijgewerkt en toch tegenstrijdig ⇒ kritiek; `last_reported` telt mee; 400 willekeurige leeftijden/volgordes (kritiek alleen bij een synchrone keten, nooit een route bij een niet-synchrone afwijking); in de browser een reeks van zes updates in wisselende volgorde.

## 5. Afgeschermde beeldroute (Media Source)

| Onderdeel | Uitvoering |
|---|---|
| Configuratie | `image: media-source://media_source/local/energiehuis/<bestand>.webp`. Het bestand staat in de HA-mediamap, **niet** in `/config/www` (dat is publiek via `/local/`) en niet in GitHub. |
| Ophalen | `hass.callWS({ type: 'media_source/resolve_media', media_content_id })` geeft een tijdelijk getekende URL (`/media/local/…?authSig=…`), daarna via `hass.hassUrl()`. |
| Validatie | Alleen een same-origin pad onder `/media/` wordt geaccepteerd (geen externe URL, geen `/local/`, geen `..`). |
| Verlopen | Lukt het laden niet (bijv. verlopen handtekening of een HA-herstart), dan wordt **één keer** opnieuw opgelost. Daarna volgt de veilige terugval: alleen de interface (lijstweergave), met melding; de data werkt gewoon door. |
| Mislukt / hangt (RC1-D) | Een afgewezen `resolve_media`, een lege of onveilige URL (`/local/…`, extern domein) of een opdracht die niet binnen **15 s** antwoordt ⇒ dezelfde veilige terugval, zonder enig verzoek naar `/local/` of een ander domein. |
| Herstel (RC1-D) | Staat de beeldlaag in de foutstand, dan wordt na **herstel van de verbinding** (`hass.connected` false → true) één keer opnieuw opgelost. Geen herhaalde pogingen in een lus. |
| Geen beeld geconfigureerd | Terugval "Geen beeld geconfigureerd — alleen interface", zonder enig `/media`-verzoek. |
| Na het laden | Het beeld blijft in het `<img>`-element, ook na het verlopen van de handtekening, ontkoppelen/koppelen en een herverbinding (getest: geen nieuwe resolve of `/media`-verzoek). Opnieuw opbouwen (nieuwe configuratie) lost opnieuw op. |
| Nooit | Een vaste publieke `/local/`-route, `/config/www`, uitgeschakelde toegangscontrole, eigen tokens of `auth/sign_path`. |

**Getest (gesimuleerd, `tools/serve-ha-preview.cjs`):**
- de master komt alleen via een getekende URL; zonder handtekening 401, met een vervalste handtekening 403;
- een verlopen handtekening geeft 2 resolves en daarna de terugval;
- het openbare repositorypad wordt niet gebruikt;
- RC1-D: mislukte, hangende (time-out), lege, `/local/`- en externe resolve ⇒ terugval zonder verzoek buiten `/media`; verlopen handtekening ná het laden ⇒ beeld blijft staan; mislukt beeld ⇒ herstel na herverbinding.

**Status: onbevestigd.** De echte URL-vorm, de authenticatie en de iPhone-compatibiliteit zijn in RC1 uitsluitend gesimuleerd.

**Alleen in een afzonderlijk goedgekeurde echte HA-test te controleren:**
1. De werkelijke respons van `media_source/resolve_media` voor `media-source://media_source/local/…`: vorm van de URL (pad `/media/local/…`, parameter `authSig`), `mime_type`, en of `hass.hassUrl()` de juiste origin geeft (lokaal, via Nabu Casa en via een reverse proxy).
2. De geldigheidsduur van de handtekening en wat er gebeurt bij herladen van het dashboard, een HA-herstart en een token-vernieuwing.
3. Dat `/media/local/…` zonder geldige `authSig` wordt geweigerd (401/403) en dat het bestand niet via `/local/` bereikbaar is.
4. iPhone: Companion-app (WKWebView) en Safari — laden van de WebP, rendering van het canvas (bemonstering van randkleuren, same-origin), de terugval bij geweigerd beeld, geheugen en de lichtpunten op een echt toestel.
5. Of `hass.connected` in de Companion-app betrouwbaar wisselt bij netwerkverlies (offline-status) en of het herstel na herverbinding werkt.
6. `last_reported` in `hass.states` en de werkelijke updatefrequenties (zie §4.7).

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
| Toon-TTL, tijdstempelvolgorde, laatste stand | v1.25-cockpit | gelijk; alleen stabiele 0 W en SOC |
| Route-TTL (bewegende lichtpunten) | geen animatie | 60 s (P1/huis), 90 s (PV/Alfen), instelbaar |
| Balans | "Geen energiebalans" | alleen bij een synchrone keten; kritiek alleen dan (§4b) |
| Offline | — | kop en pil rood "OFFLINE", nooit een groene LIVE-markering (RC1-C) |

## 8. Open punten

1. Echte HA-test (aparte toestemming): bestaan, eenheden en verversfrequentie van alle entiteiten; `last_reported` in `hass.states`; de Media Source-route (de zes controles in §5); daarna `route_ttl_s` en `balance_max_skew_s` op basis van metingen vastleggen.
2. De definitie van de huisverbruik-template vastleggen.
3. Besluit van de eigenaar over de openbare GitHub-kopie van de master.
