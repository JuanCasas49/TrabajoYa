import amqp from 'amqplib';
import { pool } from './db.js';
import { REGION } from './regions.js';

// Patrón Transactional Outbox: el evento se guarda en la MISMA transacción que el dato de negocio y
// un publicador lo envía a RabbitMQ después. Si el broker está caído, no se pierde nada: se reintenta.
export const EXCHANGE = 'trabajoya.events';
export const brokerEnabled = () => Boolean(process.env.AMQP_URL);

export async function emit(client, type, payload) {
  if (!brokerEnabled()) return;
  await client.query('INSERT INTO outbox (type, payload) VALUES ($1, $2)', [type, payload]);
}

let conn = null;
let ch = null;
async function channel() {
  if (ch) return ch;
  conn = await amqp.connect(process.env.AMQP_URL);
  conn.on('error', () => {});
  conn.on('close', () => { conn = null; ch = null; });
  ch = await conn.createConfirmChannel();
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
  return ch;
}

const publish = (c, e) => new Promise((resolve, reject) => {
  const body = Buffer.from(JSON.stringify({ id: e.id, region: REGION.code, type: e.type, payload: e.payload, at: e.created_at }));
  c.publish(EXCHANGE, `${REGION.code}.${e.type}`, body,
    { persistent: true, messageId: `${REGION.code}-${e.id}`, contentType: 'application/json' },
    (err) => (err ? reject(err) : resolve()));
});

async function tick() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, type, payload, created_at FROM outbox WHERE published_at IS NULL ORDER BY id LIMIT 50 FOR UPDATE SKIP LOCKED`);
    if (rows.length) {
      const c = await channel();
      for (const e of rows) await publish(c, e);
      await client.query('UPDATE outbox SET published_at = now() WHERE id = ANY($1)', [rows.map((r) => r.id)]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    ch = null; // reconectar en el próximo ciclo
  } finally {
    client.release();
  }
}

export function startOutbox() {
  if (!brokerEnabled()) return console.log('ℹ️  AMQP_URL no definido: eventos desactivados');
  setInterval(() => tick().catch(() => {}), 2000).unref();
  console.log('📨 Outbox → RabbitMQ activo');
}
