import { Router } from 'express';
import { pool } from '../db.js';
import { h } from '../util.js';
import { auth } from '../middleware/auth.js';
import { emit } from '../events.js';

const r = Router();

// El dueño acepta una oferta: las demás se rechazan y el trabajo queda asignado
r.post('/:id/accept', auth, h(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = (await client.query(
      `SELECT b.id, b.job_id, j.owner_id, j.status FROM bids b JOIN jobs j ON j.id=b.job_id
        WHERE b.id=$1 FOR UPDATE OF j`, [req.params.id])).rows[0];
    if (!b || b.owner_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Oferta no encontrada' });
    }
    if (b.status !== 'open') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'El trabajo ya no está abierto' });
    }
    await client.query(
      `UPDATE bids SET status = CASE WHEN id=$1 THEN 'accepted' ELSE 'rejected' END WHERE job_id=$2`, [b.id, b.job_id]);
    await client.query(`UPDATE jobs SET status='assigned' WHERE id=$1`, [b.job_id]);
    await emit(client, 'bid.accepted', { bidId: b.id, jobId: b.job_id });
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

export default r;
