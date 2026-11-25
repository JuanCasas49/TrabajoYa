import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { REGIONS } from './regions.js';
import { counters, startConsumer, state as broker } from './consumer.js';

// ---------- Registro de regiones (service registry) ----------
const norm = (u) => (/^https?:\/\//.test(u) ? u : `http://${u}`).replace(/\/+$/, '');
let fromJson = {};
try { fromJson = JSON.parse(process.env.REGION_URLS || '{}'); } catch { console.error('REGION_URLS no es JSON válido'); }
const urls = {};
for (const code of Object.keys(REGIONS)) {
  const u = fromJson[code] || process.env[`REGION_URL_${code}`];
  if (u) urls[code] = norm(u);
}

const status = Object.fromEntries(Object.keys(urls).map((c) => [c, { up: false, failures: 0, latencyMs: null, checkedAt: null }]));

// Health check periódico. Una región se marca caída tras 2 fallos seguidos y se recupera con 1 éxito.
async function check(code) {
  const t = Date.now();
  const s = status[code];
  try {
    const r = await fetch(`${urls[code]}/api/health`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('unhealthy');
    Object.assign(s, { up: true, failures: 0, latencyMs: Date.now() - t });
  } catch {
    s.failures += 1;
    if (s.failures >= 2) { s.up = false; s.latencyMs = null; }
  }
  s.checkedAt = new Date().toISOString();
}
const checkAll = () => Promise.all(Object.keys(urls).map(check));
await checkAll();
setInterval(checkAll, Number(process.env.HEALTH_INTERVAL_MS) || 10000).unref();
startConsumer(process.env.AMQP_URL);

// ---------- Enrutamiento por región (transparencia de ubicación) ----------
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));

app.get('/health', (_, res) => res.json({ ok: true }));
app.get('/api/regions', (_, res) => {
  res.json(Object.values(REGIONS).map((r) => ({
    ...r, configured: Boolean(urls[r.code]), up: Boolean(status[r.code]?.up), latencyMs: status[r.code]?.latencyMs ?? null,
  })));
});
app.get('/api/global/stats', (_, res) => {
  res.json({ broker: { enabled: Boolean(process.env.AMQP_URL), connected: broker.connected, received: broker.received }, events: counters,
    regions: Object.fromEntries(Object.entries(status).map(([c, s]) => [c, s.up])) });
});

const proxies = {};
for (const [code, target] of Object.entries(urls)) {
  proxies[code] = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    // /CO/api/jobs -> /api/jobs
    pathRewrite: (p) => p.replace(/^\/[A-Za-z]{2}(?=\/|$)/, ''),
    on: {
      // El CORS lo gestiona solo el gateway (evita cabeceras duplicadas)
      proxyRes: (pr) => { for (const h of Object.keys(pr.headers)) if (h.startsWith('access-control-')) delete pr.headers[h]; },
      error: (_err, _req, res) => {
        if (res.writeHead && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Región no disponible' }));
        }
      },
    },
  });
}

app.use('/:code', (req, res, next) => {
  const code = req.params.code.toUpperCase();
  const proxy = proxies[code];
  if (!proxy) return res.status(404).json({ error: 'Región desconocida' });
  // Fallo rápido: si el registro dice que la región está caída, no se intenta (aísla la falla)
  if (!status[code].up) return res.status(503).json({ error: 'Región no disponible', region: code });
  proxy(req, res, next);
});

const server = http.createServer(app);
server.on('upgrade', (req, socket, head) => {
  const code = (req.url.match(/^\/([A-Za-z]{2})\//) || [])[1]?.toUpperCase();
  if (code && proxies[code] && status[code].up) proxies[code].upgrade(req, socket, head);
  else socket.destroy();
});

const port = process.env.PORT || 8080;
server.listen(port, () => console.log(`🌐 Gateway en http://localhost:${port} · regiones: ${Object.keys(urls).join(', ') || '(ninguna)'}`));
