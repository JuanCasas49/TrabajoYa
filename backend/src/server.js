import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { pool } from './db.js';
import { REGION } from './regions.js';
import { startOutbox } from './events.js';
import { h } from './util.js';
import { setupSocket } from './socket.js';
import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import bidRoutes from './routes/bids.js';
import chatRoutes from './routes/chat.js';

if (!process.env.JWT_SECRET) throw new Error('Falta JWT_SECRET en .env');

const origins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : undefined;
const app = express();
app.set('trust proxy', 1); // Render está detrás de un proxy
const server = http.createServer(app);
app.set('io', setupSocket(server, origins));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: origins || true }));
app.use((_, res, next) => { res.setHeader('X-Region', REGION.code); next(); });
app.use(express.json({ limit: '100kb' }));
app.use('/uploads', express.static(path.resolve('uploads'), { maxAge: '7d' }));

app.get('/api/health', async (_, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, region: REGION.code, uptime: Math.round(process.uptime()) });
  } catch {
    res.status(503).json({ ok: false, region: REGION.code });
  }
});
app.get('/api/meta', h(async (_, res) => {
  const categories = (await pool.query('SELECT slug FROM categories ORDER BY slug')).rows.map((c) => c.slug);
  res.json({ region: REGION, categories });
}));
app.get('/api/stats', h(async (_, res) => {
  const q = (sql) => pool.query(sql).then((r) => r.rows[0].n);
  res.json({
    region: REGION.code,
    users: await q('SELECT count(*)::int n FROM users'),
    open_jobs: await q("SELECT count(*)::int n FROM jobs WHERE status='open'"),
    bids: await q('SELECT count(*)::int n FROM bids'),
  });
}));

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 50 }), authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api', chatRoutes);

app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) return res.status(400).json({ error: err.issues[0].message });
  if (err.code === '23505') return res.status(409).json({ error: 'Ese correo ya está registrado' });
  if (err.code === '23503' || err.code === '22P02') return res.status(400).json({ error: 'Datos inválidos' });
  if (err.message === 'No se pudo subir la imagen') return res.status(502).json({ error: err.message });
  if (err.name === 'MulterError') return res.status(400).json({ error: 'Imagen inválida (máx. 5 fotos de 5 MB)' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const port = process.env.PORT || 4000;
server.listen(port, () => {
  console.log(`🚀 API región ${REGION.code} (${REGION.currency}) en http://localhost:${port}`);
  startOutbox();
});
