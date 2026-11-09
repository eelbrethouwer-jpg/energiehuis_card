/* GEGENEREERD door tools/build-manifest.cjs — niet met de hand bewerken.
 * Energiehuis PVE-04 scènemanifest: beeldlagen, SHA-256, budgetten, maskers, ankerpunten en rechten.
 * Laadt als gewoon script (ook via file://), zonder netwerkverzoeken. */
(function (root) {
  'use strict';
  const MANIFEST = {
    "schema": "energiehuis.scene-manifest/1",
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
            "rights": "R-PVE04-PLACEHOLDER-CGI"
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
        }
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
            "rights": "R-PVE04-PLACEHOLDER-CGI"
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
        }
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
