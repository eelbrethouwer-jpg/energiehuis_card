'use strict';
/*
 * PVE-04 HA-01 · lokale testserver voor de LIVE-preview (geen Home Assistant, geen netwerk naar buiten).
 *   node preview/pve-04/tools/serve-ha-preview.cjs [--port=8123]   → http://127.0.0.1:8123/pve-04/ha/
 * Serveert preview/ statisch en SIMULEERT de geauthenticeerde Media Source-route van Home Assistant:
 *   GET /__sign?path=/media/local/…&ttl=30  → { url: '/media/local/…?authSig=…' }   (zoals media_source/resolve_media)
 *   GET /media/local/…?authSig=…            → beeld, alleen met een geldige, niet-verlopen handtekening; anders 401/403.
 * /media/local/energiehuis/<bestand> verwijst naar preview/pve-03/reference/<bestand>. Alleen voor tests.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..', '..');           // preview/
const MEDIA = path.join(ROOT, 'pve-03', 'reference');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const SECRET = crypto.randomBytes(16);

function sign(p, ttlS, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ p, exp: now + ttlS * 1000 })).toString('base64url');
  return payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}
function verify(p, sig, now = Date.now()) {
  if (!sig || !sig.includes('.')) return 'ontbreekt';
  const [payload, mac] = sig.split('.');
  const good = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return 'ongeldig';
  let o; try { o = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch (e) { return 'ongeldig'; }
  if (o.p !== p) return 'ander pad';
  if (now > o.exp) return 'verlopen';
  return null;
}

function createServer({ log = [] } = {}) {
  return http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const p = decodeURIComponent(u.pathname);
    log.push({ path: p, query: u.search, t: Date.now() });
    if (p === '/__sign') {
      const target = u.searchParams.get('path') || '';
      if (!/^\/media\/local\/energiehuis\/[A-Za-z0-9._-]+$/.test(target)) { res.writeHead(400); return res.end(); }
      const ttl = Math.max(0, Math.min(3600, u.searchParams.has("ttl") ? +u.searchParams.get("ttl") : 30));
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ url: target + '?authSig=' + sign(target, ttl), mime_type: 'image/webp' }));
    }
    if (p.startsWith('/media/')) {
      const m = /^\/media\/local\/energiehuis\/([A-Za-z0-9._-]+)$/.exec(p);
      const why = m ? verify(p, u.searchParams.get('authSig')) : 'pad';
      if (why) { res.writeHead(why === 'ontbreekt' ? 401 : 403, { 'cache-control': 'no-store' }); return res.end('geweigerd: ' + why); }
      const f = path.join(MEDIA, m[1]);
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'private, no-store' });
      return res.end(fs.readFileSync(f));
    }
    const file = path.join(ROOT, p.endsWith('/') ? p + 'index.html' : p);
    if (!path.resolve(file).startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(fs.readFileSync(file));
  });
}

module.exports = { createServer, sign, verify };
if (require.main === module) {
  const port = +((process.argv.find(a => a.startsWith('--port=')) || '--port=8123').split('=')[1]);
  createServer().listen(port, '127.0.0.1', () => console.log(`LIVE-preview (gesimuleerde HA): http://127.0.0.1:${port}/pve-04/ha/`));
}
