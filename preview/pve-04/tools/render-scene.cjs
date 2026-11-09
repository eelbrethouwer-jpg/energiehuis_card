'use strict';
/*
 * PVE-04 — offline renderer voor de TIJDELIJKE (placeholder) CGI-laag en de occlusiemaskers.
 * Build-tool: de preview zelf laadt nooit three.js. Het definitieve, fotorealistische beeld komt uit
 * de stap-1-pipeline (Blender Cycles) en vervangt deze bestanden via hetzelfde manifest.
 *
 *   npm install --prefix /tmp/pve04-three three@0.170.0
 *   THREE_DIR=/tmp/pve04-three/node_modules/three node preview/pve-04/tools/render-scene.cjs
 *   node preview/pve-04/tools/build-manifest.cjs
 *
 * Output (preview/pve-04/assets/):
 *   placeholder-desktop-{1330,2660}.{webp,jpg}, placeholder-mobile-{540,1080}.{webp,jpg}
 *   mask-desktop-1330.png, mask-mobile-540.png   (wit, alfa = voorgrond-occlusie)
 * en tools/render-output.json (ankerpunten per compositie, genormaliseerd 0..1).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TOOLS = __dirname;
const OUT = path.join(__dirname, '..', 'assets');
const THREE_DIR = process.env.THREE_DIR;
if (!THREE_DIR || !fs.existsSync(path.join(THREE_DIR, 'build', 'three.module.js'))) {
  console.error('Set THREE_DIR to an installed three@0.170.0 package directory.');
  process.exit(2);
}
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), __dirname] }));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const root = u.startsWith('/three/') ? THREE_DIR : TOOLS;
      const file = u.startsWith('/three/') ? path.join(THREE_DIR, u.slice(7)) : path.join(TOOLS, u);
      if (!path.resolve(file).startsWith(path.resolve(root)) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const JOBS = [
  { layout: 'desktop', w: 2660, h: 1496, sizes: [2660, 1330], mask: 1330 },
  { layout: 'mobile', w: 1080, h: 1920, sizes: [1080, 540], mask: 540 }
];
const b64 = d => Buffer.from(d.split(',')[1], 'base64');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const output = { generator: 'preview/pve-04/tools/scene.html', status: 'placeholder', compositions: {} };
  try {
    for (const job of JOBS) {
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
      page.on('pageerror', e => console.error('[scene] pageerror', e.message));
      await page.goto(`http://127.0.0.1:${port}/scene.html?layout=${job.layout}&w=${job.w}&h=${job.h}`);
      await page.waitForFunction('window.__done === true', null, { timeout: 600000 });
      output.compositions[job.layout] = { natural: { w: job.w, h: job.h }, anchors: await page.evaluate('window.__anchors'), boxes: await page.evaluate('window.__boxes') };
      for (const size of job.sizes) {
        const h = Math.round(job.h * size / job.w);
        const out = await page.evaluate(([w, h]) => {
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(document.querySelector('canvas'), 0, 0, w, h);
          return { webp: c.toDataURL('image/webp', 0.8), jpg: c.toDataURL('image/jpeg', 0.82) };
        }, [size, h]);
        for (const [ext, data] of Object.entries(out)) {
          const file = path.join(OUT, `placeholder-${job.layout}-${size}.${ext}`);
          fs.writeFileSync(file, b64(data));
          console.log(path.relative(process.cwd(), file), `${size}x${h}`);
        }
      }
      // Maskerpass: luminantie -> alfa (wit = voorgrondobject dat routes afdekt)
      await page.evaluate('window.renderMask()');
      const mh = Math.round(job.h * job.mask / job.w);
      const png = await page.evaluate(([w, h]) => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(document.querySelector('canvas'), 0, 0, w, h);
        const img = g.getImageData(0, 0, w, h), d = img.data;
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let i = 0; i < d.length; i += 4) {
          const a = Math.max(d[i], d[i + 1], d[i + 2]); d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a;
          if (a > 0) { const p = i / 4, x = p % w, y = (p - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        g.putImageData(img, 0, 0);
        const r = v => +v.toFixed(4);
        return { url: c.toDataURL('image/png'), bbox: x1 < 0 ? null : { x: r(x0 / w), y: r(y0 / h), w: r((x1 - x0 + 1) / w), h: r((y1 - y0 + 1) / h) } };
      }, [job.mask, mh]);
      const mfile = path.join(OUT, `mask-${job.layout}-${job.mask}.png`);
      fs.writeFileSync(mfile, b64(png.url));
      output.compositions[job.layout].maskBoxes = { foreground: png.bbox };
      console.log(path.relative(process.cwd(), mfile), `${job.mask}x${mh}`);
      await page.close();
    }
  } finally {
    await browser.close();
    srv.close();
  }
  fs.writeFileSync(path.join(TOOLS, 'render-output.json'), JSON.stringify(output, null, 2) + '\n');
  console.log('render-output.json geschreven; draai nu tools/build-manifest.cjs');
})().catch(e => { console.error(e); process.exit(1); });
