import 'dotenv/config';
import pg from 'pg';

// DATE como texto (AAAA-MM-DD): evita desfases de zona horaria
pg.types.setTypeParser(1082, (v) => v);

if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en .env');
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
