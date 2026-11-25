import amqp from 'amqplib';

// Subsistema de analítica global: consume los eventos de TODAS las regiones desde RabbitMQ.
// El estado vive en memoria (vista derivada); la fuente de verdad sigue en la BD de cada región.
export const counters = {};            // { CO: { 'job.created': 3, ... }, ... }
export const state = { connected: false, received: 0 };
const seen = new Set();                // idempotencia: ignora mensajes repetidos (entrega "al menos una vez")

export function startConsumer(url) {
  if (!url) return;
  const connect = async () => {
    try {
      const conn = await amqp.connect(url);
      conn.on('error', () => {});
      conn.on('close', () => { state.connected = false; setTimeout(connect, 5000); });
      const ch = await conn.createChannel();
      await ch.assertExchange('trabajoya.events', 'topic', { durable: true });
      const { queue } = await ch.assertQueue('gateway.analytics', { durable: true });
      await ch.bindQueue(queue, 'trabajoya.events', '#');
      await ch.consume(queue, (msg) => {
        if (!msg) return;
        try {
          const ev = JSON.parse(msg.content.toString());
          const id = msg.properties.messageId;
          if (!seen.has(id)) {
            seen.add(id);
            if (seen.size > 5000) seen.delete(seen.values().next().value);
            counters[ev.region] ??= {};
            counters[ev.region][ev.type] = (counters[ev.region][ev.type] || 0) + 1;
            state.received++;
          }
        } catch { /* mensaje inválido: se descarta */ }
        ch.ack(msg);
      });
      state.connected = true;
    } catch {
      setTimeout(connect, 5000);
    }
  };
  connect();
}
