/* Serveur de développement local : fichiers statiques + rewrites émulant
   vercel.json (API FrenchStream, anime, drama). Usage : node dev-server.js
   Port : process.env.PORT sinon 3100. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 3100;
const ROOT = __dirname;

/* Mêmes règles que vercel.json. */
const REWRITES = [
  { re: /^\/api\/fs\/(.*)$/, to: 'https://noxcontent-production.up.railway.app/$1' },
  { re: /^\/api\/anime\/(.*)$/, to: 'https://anime-api-production-e95c.up.railway.app/$1' },
  { re: /^\/api\/drama\/health$/, to: 'https://drama-api-production-8ed6.up.railway.app/api/health' },
  { re: /^\/api\/drama\/(.*)$/, to: 'https://drama-api-production-8ed6.up.railway.app/api/v1/reelshort/$1' },
];

function proxy(req, res, target) {
  const headers = { ...req.headers, host: new URL(target).host };
  delete headers['accept-encoding'];           /* réponse non compressée */
  const upstream = https.request(target, { method: req.method, headers }, up => {
    res.writeHead(up.statusCode, up.headers);
    up.pipe(res);
  });
  upstream.on('error', e => { res.writeHead(502); res.end('proxy error: ' + e.message); });
  req.pipe(upstream);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  for (const r of REWRITES) {
    const m = req.url.match(r.re);
    if (m) return proxy(req, res, r.to.replace(/\$(\d)/g, (_, i) => m[i]));
  }
  const file = path.join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`NOX dev server (rewrites inclus) : http://localhost:${PORT}`));
