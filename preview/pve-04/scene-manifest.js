/* GEGENEREERD door tools/build-manifest.cjs — niet met de hand bewerken.
 * Energiehuis PVE-04 scènemanifest: beeldlagen, SHA-256, budgetten, maskers, ankerpunten en rechten.
 * Laadt als gewoon script (ook via file://), zonder netwerkverzoeken. */
(function (root) {
  'use strict';
  const MANIFEST = {
    "schema": "energiehuis.scene-manifest/2",
    "coordinateSystem": {
      "id": "normalized-image",
      "origin": "linksboven van de natuurlijke beeldlaag",
      "axes": "x naar rechts, y naar beneden",
      "unit": "fractie van natural.w (x, w) en natural.h (y, h); 0..1 = binnen beeld",
      "mapping": "object-fit: cover, gecentreerd (50% 50%): scherm = offset + waarde × geschaalde beeldmaat (flows.coverTransform)"
    },
    "sceneId": "pve04-placeholder-cgi",
    "status": "placeholder",
    "statusLabel": "Tijdelijk beeld — niet visueel goedgekeurd",
    "compositions": {
      "desktop": {
        "minContainerWidth": 700,
        "natural": {
          "w": 2660,
          "h": 1496
        },
        "budgetBytes": 1572864,
        "base": [
          {
            "file": "assets/placeholder-desktop-1330.webp",
            "type": "image/webp",
            "w": 1330,
            "h": 748,
            "alpha": false,
            "bytes": 52010,
            "sha256": "04629fce706e8dc7159bbb622d957e9cb0a29a7f494f8a7a06b862bca09faa42",
            "rights": "R-PVE04-PLACEHOLDER-CGI"
          },
          {
            "file": "assets/placeholder-desktop-2660.webp",
            "type": "image/webp",
            "w": 2660,
            "h": 1496,
            "alpha": false,
            "bytes": 133000,
            "sha256": "110014c0dcdd1de832cd94b64253b5ee63078020a68996ab9f0888587adad613",
            "rights": "R-PVE04-PLACEHOLDER-CGI"
          },
          {
            "file": "assets/placeholder-desktop-1330.jpg",
            "type": "image/jpeg",
            "w": 1330,
            "h": 748,
            "alpha": false,
            "bytes": 103969,
            "sha256": "53c4adbea286758ae08934b76982b52e08ecd209fa5642ca93fd622c37f3f22c",
            "rights": "R-PVE04-PLACEHOLDER-CGI"
          },
          {
            "file": "assets/placeholder-desktop-2660.jpg",
            "type": "image/jpeg",
            "w": 2660,
            "h": 1496,
            "alpha": false,
            "bytes": 314160,
            "sha256": "d63f52ece330613bad40947f348081f9adf542e2fea2caa168d72e5a86220a51",
            "rights": "R-PVE04-PLACEHOLDER-CGI"
          }
        ],
        "masks": [
          {
            "id": "foreground",
            "semantics": "alfa = voorgrond-occlusie (deeltjes en routelijnen verdwijnen erachter; UI-kaarten niet)",
            "file": "assets/mask-desktop-1330.png",
            "type": "image/png",
            "w": 1330,
            "h": 748,
            "alpha": true,
            "bytes": 41420,
            "sha256": "27e06347c3af630d19156711947c9bd50e1b083a9b66576094c5c3b9f8783f6e",
            "rights": "R-PVE04-PLACEHOLDER-CGI",
            "bbox": {
              "x": 0.0083,
              "y": 0.6457,
              "w": 0.903,
              "h": 0.2326
            }
          }
        ],
        "anchors": {
          "pv": {
            "x": 0.4527,
            "y": 0.2952
          },
          "house": {
            "x": 0.4289,
            "y": 0.6307
          },
          "charger": {
            "x": 0.9098,
            "y": 0.6862
          },
          "practice": {
            "x": 0.1246,
            "y": 0.639
          },
          "cupra": {
            "x": 0.7849,
            "y": 0.7291
          },
          "cupraPort": {
            "x": 0.888,
            "y": 0.7163
          },
          "cupraFront": {
            "x": 0.7277,
            "y": 0.7675
          }
        },
        "uiZones": [
          {
            "id": "pv",
            "x": 0,
            "y": 0,
            "w": 0.35,
            "h": 0.25,
            "purpose": "Zonnepanelen-kaart linksboven, naast het dak"
          },
          {
            "id": "practice",
            "x": 0,
            "y": 0.25,
            "w": 0.35,
            "h": 0.35,
            "purpose": "Praktijkkaart links, boven het bijgebouw"
          },
          {
            "id": "battery",
            "x": 0,
            "y": 0.7,
            "w": 0.35,
            "h": 0.3,
            "purpose": "Virtuele batterij linksonder"
          },
          {
            "id": "house",
            "x": 0.35,
            "y": 0.55,
            "w": 0.3,
            "h": 0.25,
            "purpose": "Huiskaart midden op de gevel"
          },
          {
            "id": "net",
            "x": 0.35,
            "y": 0.82,
            "w": 0.3,
            "h": 0.18,
            "purpose": "Net midden onder de woning"
          },
          {
            "id": "cupra",
            "x": 0.65,
            "y": 0.1,
            "w": 0.35,
            "h": 0.45,
            "purpose": "Cupra-kaart boven de auto"
          }
        ],
        "keyObjects": {
          "pv": {
            "x": 0.3137,
            "y": 0.2202,
            "w": 0.2841,
            "h": 0.1545,
            "clipped": false
          },
          "house": {
            "x": 0.2448,
            "y": 0.0123,
            "w": 0.4947,
            "h": 0.7653,
            "clipped": false
          },
          "garage": {
            "x": 0.7051,
            "y": 0.4761,
            "w": 0.2949,
            "h": 0.3601,
            "clipped": true
          },
          "charger": {
            "x": 0.8943,
            "y": 0.6503,
            "w": 0.0334,
            "h": 0.0718,
            "clipped": false
          },
          "practice": {
            "x": 0,
            "y": 0.4692,
            "w": 0.2642,
            "h": 0.3374,
            "clipped": true
          },
          "car": {
            "x": 0.673,
            "y": 0.6454,
            "w": 0.2292,
            "h": 0.2212,
            "clipped": false
          }
        },
        "outOfView": [],
        "protectedAreas": [
          {
            "id": "car",
            "from": "car",
            "purpose": "Groene auto: carrosserie en ruiten",
            "x": 0.7074,
            "y": 0.6786,
            "w": 0.1604,
            "h": 0.1548
          },
          {
            "id": "practice-front",
            "from": "practice",
            "purpose": "Praktijk: verlichte schuifpui",
            "x": 0.0528,
            "y": 0.5367,
            "w": 0.1585,
            "h": 0.2024
          },
          {
            "id": "pv",
            "from": "pv",
            "purpose": "Zonnepanelen",
            "x": 0.3563,
            "y": 0.2434,
            "w": 0.1989,
            "h": 0.1081
          },
          {
            "id": "house-upper",
            "from": "house",
            "purpose": "Woning: dak, dakkapel en topgevel",
            "x": 0.3685,
            "y": 0.1271,
            "w": 0.2473,
            "h": 0.3061
          }
        ],
        "lightLayers": []
      },
      "mobile": {
        "minContainerWidth": 0,
        "natural": {
          "w": 1080,
          "h": 1920
        },
        "budgetBytes": 1048576,
        "base": [
          {
            "file": "assets/placeholder-mobile-540.webp",
            "type": "image/webp",
            "w": 540,
            "h": 960,
            "alpha": false,
            "bytes": 25762,
            "sha256": "d4e9ebb1ac965ce3ed981a37d01bc287e984e4eb1915447b849c68c91b66ce0f",
            "rights": "R-PVE04-PLACEHOLDER-CGI"
          },
          {
            "file": "assets/placeholder-mobile-1080.webp",
            "type": "image/webp",
            "w": 1080,
            "h": 1920,
            "alpha": false,
            "bytes": 63054,
            "sha256": "1dcc32e514488eb717d5862a81d13e9371b4d77fccd0dc3b081572857a94f04e",
            "rights": "R-PVE04-PLACEHOLDER-CGI"
          },
          {
            "file": "assets/placeholder-mobile-540.jpg",
            "type": "image/jpeg",
            "w": 540,
            "h": 960,
            "alpha": false,
            "bytes": 51796,
            "sha256": "1cfa3440aeeb27f5bd05e5a7759eaf2319b6692e28679c6d444cac9cdcd89adb",
            "rights": "R-PVE04-PLACEHOLDER-CGI"
          },
          {
            "file": "assets/placeholder-mobile-1080.jpg",
            "type": "image/jpeg",
            "w": 1080,
            "h": 1920,
            "alpha": false,
            "bytes": 159530,
            "sha256": "83466146daf3683d90a146a1e4f76e770a84406ee7f58db0470522b974af586e",
            "rights": "R-PVE04-PLACEHOLDER-CGI"
          }
        ],
        "masks": [
          {
            "id": "foreground",
            "semantics": "alfa = voorgrond-occlusie (deeltjes en routelijnen verdwijnen erachter; UI-kaarten niet)",
            "file": "assets/mask-mobile-540.png",
            "type": "image/png",
            "w": 540,
            "h": 960,
            "alpha": true,
            "bytes": 22418,
            "sha256": "136cc8ebed7dba35e916bc4ccb64da89b4d02b4bafe290cbb0535e52012f1126",
            "rights": "R-PVE04-PLACEHOLDER-CGI",
            "bbox": {
              "x": 0.1148,
              "y": 0.5042,
              "w": 0.8852,
              "h": 0.2531
            }
          }
        ],
        "anchors": {
          "pv": {
            "x": 0.3636,
            "y": 0.2805
          },
          "house": {
            "x": 0.3026,
            "y": 0.4874
          },
          "charger": {
            "x": 1.0235,
            "y": 0.5359
          },
          "practice": {
            "x": 0.1089,
            "y": 0.5619
          },
          "cupra": {
            "x": 0.7595,
            "y": 0.5781
          },
          "cupraPort": {
            "x": 0.969,
            "y": 0.5702
          },
          "cupraFront": {
            "x": 0.6201,
            "y": 0.6015
          }
        },
        "uiZones": [
          {
            "id": "pv",
            "x": 0,
            "y": 0,
            "w": 0.5,
            "h": 0.22,
            "purpose": "Zonnepanelen-kaart linksboven (lucht)"
          },
          {
            "id": "battery",
            "x": 0.5,
            "y": 0,
            "w": 0.5,
            "h": 0.22,
            "purpose": "Virtuele batterij rechtsboven (lucht)"
          },
          {
            "id": "house",
            "x": 0.2,
            "y": 0.3,
            "w": 0.6,
            "h": 0.22,
            "purpose": "Huiskaart midden op de gevel"
          },
          {
            "id": "practice",
            "x": 0,
            "y": 0.58,
            "w": 0.5,
            "h": 0.25,
            "purpose": "Praktijkkaart linksonder, onder het bijgebouw"
          },
          {
            "id": "cupra",
            "x": 0.5,
            "y": 0.58,
            "w": 0.5,
            "h": 0.25,
            "purpose": "Cupra-kaart rechtsonder, onder de auto"
          },
          {
            "id": "net",
            "x": 0.15,
            "y": 0.83,
            "w": 0.7,
            "h": 0.17,
            "purpose": "Net midden onder"
          }
        ],
        "keyObjects": {
          "pv": {
            "x": 0.1002,
            "y": 0.2323,
            "w": 0.5333,
            "h": 0.0989,
            "clipped": false
          },
          "house": {
            "x": 0,
            "y": 0.1491,
            "w": 0.9532,
            "h": 0.4245,
            "clipped": true
          },
          "garage": {
            "x": 0.7506,
            "y": 0.4157,
            "w": 0.2494,
            "h": 0.2002,
            "clipped": true
          },
          "practice": {
            "x": 0,
            "y": 0.4825,
            "w": 0.2634,
            "h": 0.1496,
            "clipped": true
          },
          "car": {
            "x": 0.5482,
            "y": 0.5228,
            "w": 0.4518,
            "h": 0.1316,
            "clipped": true
          }
        },
        "outOfView": [
          "charger"
        ],
        "protectedAreas": [
          {
            "id": "car",
            "from": "car",
            "purpose": "Groene auto: silhouet, dak en ruiten",
            "x": 0.6386,
            "y": 0.536,
            "w": 0.2711,
            "h": 0.0592
          },
          {
            "id": "practice-front",
            "from": "practice",
            "purpose": "Praktijk: dak en verlichte pui",
            "x": 0.0395,
            "y": 0.4975,
            "w": 0.1712,
            "h": 0.0823
          },
          {
            "id": "pv",
            "from": "pv",
            "purpose": "Zonnepanelen",
            "x": 0.1802,
            "y": 0.2471,
            "w": 0.3733,
            "h": 0.0692
          },
          {
            "id": "house-upper",
            "from": "house",
            "purpose": "Woning: dakkapel en topgevel",
            "x": 0.286,
            "y": 0.2128,
            "w": 0.3813,
            "h": 0.1061
          }
        ],
        "lightLayers": []
      }
    },
    "rights": {
      "R-PVE04-PLACEHOLDER-CGI": {
        "title": "Tijdelijke CGI-scènelaag en occlusiemaskers (placeholder)",
        "origin": "Eigen procedurele render: preview/pve-04/tools/scene.html via tools/render-scene.cjs (vaste seeds, reproduceerbaar). Geen foto's, logo's, kentekens, scans of modellen van derden.",
        "author": "Claude Code in opdracht van de repository-eigenaar",
        "holder": "eelbrethouwer-jpg (repository-eigenaar)",
        "license": "Eigen werk; vrij te gebruiken en te publiceren binnen dit project",
        "proof": "preview/pve-04/tools/scene.html en preview/pve-04/tools/render-scene.cjs (bron in deze repository)",
        "toolsUsed": "three.js 0.170.0 (MIT) uitsluitend als renderbibliotheek tijdens het genereren; niet meegeleverd",
        "publicAllowed": true,
        "rawSourceInRepo": "Ja: de generatorbron zelf (geen betaalde of externe ruwe modellen)",
        "visualStatus": "placeholder — NIET visueel goedgekeurd (fotorealisme vereist)"
      }
    }
  };
  if (typeof module === 'object' && module.exports) module.exports = MANIFEST;
  else root.EhPve04Manifest = MANIFEST;
})(typeof globalThis !== 'undefined' ? globalThis : this);
