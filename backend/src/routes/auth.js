import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db.js';
import { h } from '../util.js';
import { auth } from '../middleware/auth.js';
import { REGION } from '../regions.js';

const r = Router();
const sign = (u) => jwt.sign({ id: u.id, name: u.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, country_code: u.country_code.trim(), city: u.city });

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña debe tener mínimo 8 caracteres').max(100),
  city: z.string().trim().min(2).max(80),
});

r.post('/register', h(async (req, res) => {
  const d = registerSchema.parse(req.body);
  const hash = await bcrypt.hash(d.password, 11);
  const { rows } = await pool.query(
    `INSERT INTO users (name,email,password_hash,country_code,city) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [d.name, d.email, hash, REGION.code, d.city],
  );
  res.status(201).json({ token: sign(rows[0]), user: pub(rows[0]) });
}));

r.post('/login', h(async (req, res) => {
  const d = z.object({ email: z.string().trim().toLowerCase(), password: z.string() }).parse(req.body);
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [d.email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(d.password, u.password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  res.json({ token: sign(u), user: pub(u) });
}));

r.get('/me', auth, h(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
  if (!rows[0]) return res.status(401).json({ error: 'No autorizado' });
  res.json(pub(rows[0]));
}));

export default r;
