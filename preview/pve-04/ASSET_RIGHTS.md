# ASSET_RIGHTS — Energiehuis PVE-04

Rechtenregister voor **alle** beeldbestanden van de PVE-04-preview. De tests (`tests/manifest.test.cjs`) falen als een asset geen regel heeft, als een SHA-256 ontbreekt of als er een ongeregistreerd of verboden bestand in de map staat.

## Regels

1. **Elk asset** in `scene-manifest.js` verwijst naar een rechten-ID hieronder en staat met zijn SHA-256 in de tabel.
2. **Verplichte velden** per rechten-ID: titel, herkomst, maker, rechthebbende, licentie, licentiebewijs, publiek toegestaan, visuele status (en, voor stap 1: aankoopbewijs/ordernummer, licentietekst-versie en downloaddatum).
3. **Geen betaalde of externe ruwe bronbestanden** (zoals `.blend`, `.fbx`, `.glb`, `.exr`, `.hdr`, `.psd`) in deze publieke repository. `.gitignore` blokkeert ze en een test controleert het. Licentiebewijzen van aankopen worden privé bewaard door de eigenaar; hier staat alleen een verwijzing (ordernummer/datum), niet het document.
4. Alleen **gerenderde, tekstvrije** lagen (geen waarden, labels, stroomlijnen, logo's of kentekens) worden gecommit, en alleen als de licentie publicatie van renders toestaat.
5. Een manifest met status `approved` mag pas na expliciet visueel akkoord van de eigenaar. Een geslaagde technische test is **geen** visuele goedkeuring.

## Rechten-ID's

### R-PVE04-PLACEHOLDER-CGI

| Veld | Waarde |
|---|---|
| Titel | Tijdelijke CGI-scènelaag en occlusiemaskers (placeholder) |
| Herkomst | Eigen procedurele render: preview/pve-04/tools/scene.html via tools/render-scene.cjs (vaste seeds, reproduceerbaar). Geen foto's, logo's, kentekens, scans of modellen van derden. |
| Maker | Claude Code in opdracht van de repository-eigenaar |
| Rechthebbende | eelbrethouwer-jpg (repository-eigenaar) |
| Licentie | Eigen werk; vrij te gebruiken en te publiceren binnen dit project |
| Licentiebewijs | preview/pve-04/tools/scene.html en preview/pve-04/tools/render-scene.cjs (bron in deze repository) |
| Gebruikte tools | three.js 0.170.0 (MIT) uitsluitend als renderbibliotheek tijdens het genereren; niet meegeleverd |
| Publiek toegestaan | ja |
| Ruwe bron in repository | Ja: de generatorbron zelf (geen betaalde of externe ruwe modellen) |
| Visuele status | **placeholder — NIET visueel goedgekeurd (fotorealisme vereist)** |

## Assets

| Compositie | Bestand | Afmeting | Type | Bytes | SHA-256 | Rechten-ID |
|---|---|---|---|---|---|---|
| desktop | `assets/placeholder-desktop-1330.webp` | 1330×748 | image/webp | 52.010 | `04629fce706e8dc7159bbb622d957e9cb0a29a7f494f8a7a06b862bca09faa42` | R-PVE04-PLACEHOLDER-CGI |
| desktop | `assets/placeholder-desktop-2660.webp` | 2660×1496 | image/webp | 133.000 | `110014c0dcdd1de832cd94b64253b5ee63078020a68996ab9f0888587adad613` | R-PVE04-PLACEHOLDER-CGI |
| desktop | `assets/placeholder-desktop-1330.jpg` | 1330×748 | image/jpeg | 103.969 | `53c4adbea286758ae08934b76982b52e08ecd209fa5642ca93fd622c37f3f22c` | R-PVE04-PLACEHOLDER-CGI |
| desktop | `assets/placeholder-desktop-2660.jpg` | 2660×1496 | image/jpeg | 314.160 | `d63f52ece330613bad40947f348081f9adf542e2fea2caa168d72e5a86220a51` | R-PVE04-PLACEHOLDER-CGI |
| desktop | `assets/mask-desktop-1330.png` | 1330×748 | image/png | 41.420 | `27e06347c3af630d19156711947c9bd50e1b083a9b66576094c5c3b9f8783f6e` | R-PVE04-PLACEHOLDER-CGI |
| mobile | `assets/placeholder-mobile-540.webp` | 540×960 | image/webp | 25.762 | `d4e9ebb1ac965ce3ed981a37d01bc287e984e4eb1915447b849c68c91b66ce0f` | R-PVE04-PLACEHOLDER-CGI |
| mobile | `assets/placeholder-mobile-1080.webp` | 1080×1920 | image/webp | 63.054 | `1dcc32e514488eb717d5862a81d13e9371b4d77fccd0dc3b081572857a94f04e` | R-PVE04-PLACEHOLDER-CGI |
| mobile | `assets/placeholder-mobile-540.jpg` | 540×960 | image/jpeg | 51.796 | `1cfa3440aeeb27f5bd05e5a7759eaf2319b6692e28679c6d444cac9cdcd89adb` | R-PVE04-PLACEHOLDER-CGI |
| mobile | `assets/placeholder-mobile-1080.jpg` | 1080×1920 | image/jpeg | 159.530 | `83466146daf3683d90a146a1e4f76e770a84406ee7f58db0470522b974af586e` | R-PVE04-PLACEHOLDER-CGI |
| mobile | `assets/mask-mobile-540.png` | 540×960 | image/png | 22.418 | `136cc8ebed7dba35e916bc4ccb64da89b4d02b4bafe290cbb0535e52012f1126` | R-PVE04-PLACEHOLDER-CGI |

## Afgeleide bestanden

`screenshots/` bevat schermafbeeldingen van de werkende preview: de geregistreerde assets hierboven met de interface erover, plus maskervisualisaties. Ze vallen onder dezelfde rechten-ID en zijn bedoeld voor review, niet als beeldlaag.

## Sjabloon voor stap 1 (fotorealistische lagen)

```text
### R-PVE04-<ONDERWERP>
Titel / Herkomst (marktplaats + URL) / Maker / Rechthebbende / Licentie (naam + versie)
Licentiebewijs (ordernummer + datum, document privé bij eigenaar) / Gebruikte tools
Publiek toegestaan (renders) / Ruwe bron in repository: NEE / Bewerkingen (bijv. logo en kenteken verwijderd)
Visuele status: placeholder | approved (datum akkoord eigenaar)
```
