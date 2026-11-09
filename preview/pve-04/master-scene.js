/* GEGENEREERD door tools/build-master-scene.cjs uit cleanplate/overlay-map.json — niet met de hand bewerken.
 * Energiehuis PVE-04 · goedgekeurde master als vaste achtergrond: afdekvlakken voor de ingebakken kaarten en
 * de geometrie van de ingebakken stroomlijnen (genormaliseerde beeldcoördinaten). Puur data, geen netwerk. */
(function (root) {
  'use strict';
  const SCENE = {
    "schema": "energiehuis.master-scene/1",
    "status": "approved",
    "approvedBy": "eigenaar, 9 november 2026 (definitieve visuele referentie, ingebakken kaarten/stromen geaccepteerd)",
    "coordinateSystem": "normalized-image (0..1 van natural w/h, oorsprong linksboven)",
    "image": {
      "file": "../pve-03/reference/approved-visual-20261109.webp",
      "type": "image/webp",
      "natural": {
        "w": 1330,
        "h": 748
      },
      "bytes": 176622,
      "sha256": "932d0e745f8e8a415f6aab4e87091366a32d5a68d7363b908f55445fcccc7ee6"
    },
    "margin": {
      "x": 6,
      "top": 6,
      "bottom": 8
    },
    "covers": {
      "pill": {
        "overlay": "datetime-pill",
        "baked": {
          "x": 0.6887,
          "y": 0.0134,
          "w": 0.2992,
          "h": 0.0775
        },
        "x": 0.6842,
        "y": 0.0054,
        "w": 0.3082,
        "h": 0.0962
      },
      "pv": {
        "overlay": "card-pv",
        "baked": {
          "x": 0.1383,
          "y": 0.1511,
          "w": 0.1654,
          "h": 0.1417
        },
        "x": 0.1338,
        "y": 0.1431,
        "w": 0.1744,
        "h": 0.1604
      },
      "practice": {
        "overlay": "card-practice",
        "baked": {
          "x": 0.0759,
          "y": 0.4278,
          "w": 0.1406,
          "h": 0.1123
        },
        "x": 0.0714,
        "y": 0.4198,
        "w": 0.1496,
        "h": 0.131
      },
      "house": {
        "overlay": "card-house",
        "baked": {
          "x": 0.4368,
          "y": 0.4118,
          "w": 0.1632,
          "h": 0.1417
        },
        "x": 0.4323,
        "y": 0.4038,
        "w": 0.1722,
        "h": 0.1604
      },
      "cupra": {
        "overlay": "card-cupra",
        "baked": {
          "x": 0.8068,
          "y": 0.2861,
          "w": 0.1632,
          "h": 0.1497
        },
        "x": 0.8023,
        "y": 0.2781,
        "w": 0.1722,
        "h": 0.1684
      },
      "battery": {
        "overlay": "card-battery",
        "baked": {
          "x": 0.0444,
          "y": 0.738,
          "w": 0.1729,
          "h": 0.1444
        },
        "x": 0.0399,
        "y": 0.73,
        "w": 0.1819,
        "h": 0.1631
      },
      "net": {
        "overlay": "card-net",
        "baked": {
          "x": 0.4331,
          "y": 0.7366,
          "w": 0.185,
          "h": 0.1457
        },
        "x": 0.4286,
        "y": 0.7286,
        "w": 0.194,
        "h": 0.1644
      }
    },
    "flows": [
      {
        "id": "flow-pv",
        "group": "pv",
        "routes": {
          "sun-home": false
        },
        "particles": true,
        "color": "#FFC83D",
        "width": 0.0226,
        "glow": 2.8,
        "points": [
          [
            0.2992,
            0.2166
          ],
          [
            0.3308,
            0.2179
          ],
          [
            0.3534,
            0.2273
          ],
          [
            0.3684,
            0.246
          ],
          [
            0.3835,
            0.2594
          ],
          [
            0.406,
            0.2567
          ],
          [
            0.4323,
            0.2513
          ],
          [
            0.4511,
            0.254
          ],
          [
            0.4662,
            0.2674
          ],
          [
            0.4752,
            0.2941
          ],
          [
            0.4797,
            0.3342
          ],
          [
            0.4812,
            0.3743
          ],
          [
            0.482,
            0.4225
          ]
        ]
      },
      {
        "id": "flow-practice",
        "group": "practice",
        "routes": {
          "home-practice": true
        },
        "particles": true,
        "color": "#F4F1EA",
        "width": 0.0105,
        "glow": 2.4,
        "points": [
          [
            0.2143,
            0.5187
          ],
          [
            0.2331,
            0.5294
          ],
          [
            0.2556,
            0.5294
          ],
          [
            0.2782,
            0.516
          ],
          [
            0.297,
            0.5134
          ],
          [
            0.3083,
            0.5241
          ],
          [
            0.3233,
            0.5401
          ],
          [
            0.3383,
            0.5455
          ],
          [
            0.3571,
            0.5374
          ],
          [
            0.3759,
            0.5241
          ],
          [
            0.3985,
            0.5134
          ],
          [
            0.4211,
            0.508
          ],
          [
            0.4398,
            0.5053
          ]
        ]
      },
      {
        "id": "flow-net",
        "group": "net",
        "routes": {
          "home-grid": false,
          "grid-home": true
        },
        "particles": true,
        "color": "#3FE6F2",
        "width": 0.0211,
        "glow": 2.4,
        "points": [
          [
            0.5188,
            0.5508
          ],
          [
            0.5105,
            0.5882
          ],
          [
            0.5203,
            0.6283
          ],
          [
            0.512,
            0.6684
          ],
          [
            0.5188,
            0.7086
          ],
          [
            0.5158,
            0.7393
          ]
        ]
      },
      {
        "id": "flow-car",
        "group": "ev",
        "routes": {
          "home-ev": false
        },
        "particles": true,
        "color": "#7CFF4A",
        "width": 0.0211,
        "glow": 2.4,
        "points": [
          [
            0.5985,
            0.5053
          ],
          [
            0.6316,
            0.516
          ],
          [
            0.6617,
            0.5321
          ],
          [
            0.6902,
            0.5468
          ],
          [
            0.7143,
            0.5628
          ],
          [
            0.7233,
            0.5722
          ]
        ]
      },
      {
        "id": "flow-card-car",
        "group": "ev",
        "routes": {
          "home-ev": false
        },
        "particles": false,
        "color": "#7CFF4A",
        "width": 0.0135,
        "glow": 2.2,
        "points": [
          [
            0.8368,
            0.4332
          ],
          [
            0.8346,
            0.4612
          ],
          [
            0.8391,
            0.4893
          ],
          [
            0.8451,
            0.516
          ]
        ]
      }
    ],
    "keep": [
      "header-logo",
      "header-title",
      "car-plate",
      "car-logo"
    ]
  };
  const deepFreeze = o => { Object.values(o).forEach(v => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); };
  if (typeof module === 'object' && module.exports) module.exports = deepFreeze(SCENE);
  else root.EhPve04MasterScene = deepFreeze(SCENE);
})(typeof globalThis !== 'undefined' ? globalThis : this);
