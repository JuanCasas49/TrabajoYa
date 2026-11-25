import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { h } from '../util.js';
import { auth } from '../middleware/auth.js';

const r = Router();

export async function memberOf(convId, userId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.worker_id, j.owner_id FROM conversations c JOIN jobs j ON j.id=c.job_id WHERE c.id=$1`, [convId]);
  const c = rows[0];
  return c && (c.worker_id === userId || c.owner_id === userId) ? c : null;
}

// Obtiene o crea el chat de un trabajo. Aplicante: con el dueño. Dueño: debe enviar worker_id.
r.post('/jobs/:id/conversation', auth, h(async (req, res) => {
  const job = (await pool.query('SELECT owner_id FROM jobs WHERE id=$1', [req.params.id])).rows[0];
  if (!job) return res.status(404).json({ error: 'Trabajo no encontrado' });
  let workerId = req.user.id;
  if (job.owner_id === req.user.id) workerId = z.string().uuid().parse(req.body.worker_id);
  if (workerId === job.owner_id) return res.status(400).json({ error: 'Chat inválido' });
  const { rows } = await pool.query(
    `INSERT INTO conversations (job_id, worker_id) VALUES ($1,$2)
     ON CONFLICT (job_id, worker_id) DO UPDATE SET job_id=EXCLUDED.job_id RETURNING id`,
    [req.params.id, workerId]);
  res.json({ id: rows[0].id });
}));

r.get('/conversations/:id/messages', auth, h(async (req, res) => {
  if (!(await memberOf(req.params.id, req.user.id))) return res.status(404).json({ error: 'Chat no encontrado' });
  const { rows } = await pool.query(
    `SELECT * FROM (SELECT * FROM messages WHERE conversation_id=$1 ORDER BY id DESC LIMIT 200) m ORDER BY id`,
    [req.params.id]);
  res.json(rows);
}));

r.post('/conversations/:id/messages', auth, h(async (req, res) => {
  const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
  if (!(await memberOf(req.params.id, req.user.id))) return res.status(404).json({ error: 'Chat no encontrado' });
  const { rows } = await pool.query(
    'INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1,$2,$3) RETURNING *',
    [req.params.id, req.user.id, body]);
  req.app.get('io').to(`conv:${req.params.id}`).emit('message', rows[0]);
  res.status(201).json(rows[0]);
}));

export default r;
