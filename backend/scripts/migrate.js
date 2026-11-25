import 'dotenv/config';
import fs from 'node:fs';
import { pool } from '../src/db.js';

const sql = fs.readFileSync(new URL('../sql/schema.sql', import.meta.url), 'utf8');
try {
  await pool.query(sql);
  console.log('✅ Tablas creadas / actualizadas en Neon');
} catch (e) {
  console.error('❌ Error en la migración:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
