import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { pool } from '../db.js';
import { h } from '../util.js';
import { auth } from '../middleware/auth.js';
import { EXT, saveImage } from '../storage.js';
import { REGION } from '../regions.js';
import { emit } from '../events.js';

const r = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_, f, cb) => cb(null, f.mimetype in EXT),
});

// Fecha de hoy en la zona horaria del país de esta región (AAAA-MM-DD)
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: REGION.tz }).format(new Date());
const dateStr = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (usa AAAA-MM-DD)')
  .refine((d) => d >= today(), 'La fecha no puede ser pasada');

const jobSchema = z.object({
  category_slug: z.string().min(2),
  title: z.string().trim().min(4, 'Título muy corto').max(120),
  description: z.string().trim().min(10, 'Descripción muy corta').max(3000),
  city: z.string().trim().min(2).max(80),
  budget: z.coerce.number().positive('Monto inválido').max(1e12),
  estimated_date: dateStr,
});
const bidSchema = z.object({
  amount: z.coerce.number().positive('Monto inválido').max(1e12),
  estimated_date: dateStr,
  message: z.string().trim().max(1000).default(''),
});

// Feed con filtros: ?category=&city=&country=&q=&min=&max=&page=
r.get('/', auth, h(async (req, res) => {
  const { category, city, country, q, min, max, page = 1 } = req.query;
  const where = ["j.status='open'"];
  const p = [];
  const add = (sql, v) => { p.push(v); where.push(sql.replaceAll('?', `$${p.length}`)); };
  if (category) add('j.category_slug = ?', String(category));
  if (country) add('j.country_code = ?', String(country).toUpperCase());
  if (city) add('j.city ILIKE ?', `%${city}%`);
  if (q) add('(j.title ILIKE ? OR j.description ILIKE ?)', `%${q}%`);
  if (min) add('j.budget >= ?', Number(min));
  if (max) add('j.budget <= ?', Number(max));
  const limit = 20;
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;
  p.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT j.*, u.name AS owner_name,
            (SELECT url FROM job_images WHERE job_id=j.id ORDER BY id LIMIT 1) AS cover,
            (SELECT count(*) FROM bids WHERE job_id=j.id)::int AS bids_count
       FROM jobs j JOIN users u ON u.id=j.owner_id
      WHERE ${where.join(' AND ')}
      ORDER BY j.created_at DESC LIMIT $${p.length - 1} OFFSET $${p.length}`,
    p,
  );
  res.json(rows);
}));

r.get('/mine', auth, h(async (req, res) => {
  const posted = await pool.query(
    `SELECT j.*, (SELECT count(*) FROM bids WHERE job_id=j.id)::int AS bids_count
       FROM jobs j WHERE owner_id=$1 ORDER BY created_at DESC`, [req.user.id]);
  const applied = await pool.query(
    `SELECT j.*, b.amount AS bid_amount, b.status AS bid_status
       FROM bids b JOIN jobs j ON j.id=b.job_id WHERE b.worker_id=$1 ORDER BY b.created_at DESC`, [req.user.id]);
  res.json({ posted: posted.rows, applied: applied.rows });
}));

r.get('/:id', auth, h(async (req, res) => {
  const { id } = req.params;
  const job = (await pool.query(
    `SELECT j.*, u.name AS owner_name FROM jobs j JOIN users u ON u.id=j.owner_id WHERE j.id=$1`, [id])).rows[0];
  if (!job) return res.status(404).json({ error: 'Trabajo no encontrado' });
  job.images = (await pool.query('SELECT url FROM job_images WHERE job_id=$1 ORDER BY id', [id])).rows.map((x) => x.url);
  if (job.owner_id === req.user.id) {
    job.bids = (await pool.query(
      `SELECT b.*, u.name AS worker_name FROM bids b JOIN users u ON u.id=b.worker_id
        WHERE b.job_id=$1 ORDER BY b.created_at DESC`, [id])).rows;
  } else {
    job.my_bid = (await pool.query('SELECT * FROM bids WHERE job_id=$1 AND worker_id=$2', [id, req.user.id])).rows[0] || null;
  }
  res.json(job);
}));

r.post('/', auth, upload.array('images', 5), h(async (req, res) => {
  const d = jobSchema.parse(req.body);
  const urls = await Promise.all((req.files || []).map(saveImage));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const job = (await client.query(
      `INSERT INTO jobs (owner_id,category_slug,title,description,country_code,city,budget,currency,estimated_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, d.category_slug, d.title, d.description, REGION.code, d.city, d.budget, REGION.currency, d.estimated_date])).rows[0];
    for (const url of urls) await client.query('INSERT INTO job_images (job_id,url) VALUES ($1,$2)', [job.id, url]);
    await emit(client, 'job.created', { jobId: job.id, category: job.category_slug, city: job.city, budget: job.budget, currency: job.currency });
    await client.query('COMMIT');
    res.status(201).json(job);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

r.patch('/:id/status', auth, h(async (req, res) => {
  const { status } = z.object({ status: z.enum(['completed', 'cancelled']) }).parse(req.body);
  const { rowCount } = await pool.query('UPDATE jobs SET status=$1 WHERE id=$2 AND owner_id=$3', [status, req.params.id, req.user.id]);
  if (!rowCount) return res.status(404).json({ error: 'Trabajo no encontrado' });
  res.json({ ok: true });
}));

// Crear o actualizar mi oferta (monto + fecha) en un trabajo
r.post('/:id/bids', auth, h(async (req, res) => {
  const d = bidSchema.parse(req.body);
  const job = (await pool.query('SELECT owner_id, status FROM jobs WHERE id=$1', [req.params.id])).rows[0];
  if (!job) return res.status(404).json({ error: 'Trabajo no encontrado' });
  if (job.owner_id === req.user.id) return res.status(403).json({ error: 'No puedes ofertar en tu propio trabajo' });
  if (job.status !== 'open') return res.status(409).json({ error: 'Este trabajo ya no está disponible' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO bids (job_id,worker_id,amount,estimated_date,message) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (job_id,worker_id) DO UPDATE
         SET amount=EXCLUDED.amount, estimated_date=EXCLUDED.estimated_date, message=EXCLUDED.message, status='pending'
       RETURNING *`,
      [req.params.id, req.user.id, d.amount, d.estimated_date, d.message]);
    await emit(client, 'bid.placed', { bidId: rows[0].id, jobId: req.params.id, amount: rows[0].amount });
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

export default r;
