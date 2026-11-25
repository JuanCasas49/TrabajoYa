// Pruebas de FALLA (tolerancia a fallos). Requiere: docker compose up --build  y docker CLI en el PATH.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GW = process.env.GATEWAY_URL || 'http://localhost:8080';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// docker compose se ejecuta desde la raíz del repo (donde está docker-compose.yml)
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const sh = (cmd) => execSync(cmd, { stdio: 'inherit', cwd: ROOT });
const regions = async () => (await fetch(`${GW}/api/regions`)).json();
const stats = async () => (await fetch(`${GW}/api/global/stats`)).json();

async function waitFor(fn, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn().catch(() => false)) return true; await sleep(1000); }
  return false;
}
const regionIs = (code, up) => async () => (await regions()).find((r) => r.code === code).up === up;

async function newSession(code = 'CO') {
  const res = await fetch(`${GW}/${code}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Falla', email: `f${Date.now()}@example.com`, password: 'password123', city: 'Bogotá' }) });
  return (await res.json()).token;
}
async function createJob(token, code = 'CO') {
  const fd = new FormData();
  Object.entries({ category_slug: 'cleaning', title: `Prueba de falla ${Date.now()}`, description: 'Trabajo de prueba de tolerancia a fallos',
    city: 'Bogotá', budget: '50', estimated_date: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10) }).forEach(([k, v]) => fd.append(k, v));
  return fetch(`${GW}/${code}/api/jobs`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
}

test('falla de una región (BR): se aísla, las demás siguen y se recupera sola', async () => {
  try {
    sh('docker compose stop api-br');
    assert.ok(await waitFor(regionIs('BR', false)), 'el gateway debe detectar la caída de BR');
    assert.equal((await fetch(`${GW}/BR/api/meta`)).status, 503, 'BR responde 503 rápido (fail-fast)');
    for (const ok of ['CO', 'US', 'FR', 'DE']) assert.equal((await fetch(`${GW}/${ok}/api/meta`)).status, 200, `${ok} debe seguir funcionando`);
  } finally { sh('docker compose start api-br'); }
  assert.ok(await waitFor(regionIs('BR', true)), 'BR debe recuperarse y volver al registro');
  assert.equal((await fetch(`${GW}/BR/api/meta`)).status, 200);
});

test('falla de la base de datos de una región (DE): solo DE queda fuera', async () => {
  try {
    sh('docker compose stop pg-de');
    assert.ok(await waitFor(regionIs('DE', false)), 'el health check de DE debe fallar al caer su BD');
    assert.equal((await fetch(`${GW}/FR/api/meta`)).status, 200);
  } finally { sh('docker compose start pg-de'); }
  assert.ok(await waitFor(regionIs('DE', true)), 'DE debe recuperarse');
});

test('falla del broker (RabbitMQ): las regiones siguen aceptando trabajos y los eventos no se pierden (outbox)', async () => {
  const token = await newSession('CO');
  const before = (await stats()).events?.CO?.['job.created'] || 0;
  try {
    sh('docker compose stop rabbitmq');
    const res = await createJob(token);
    assert.equal(res.status, 201, 'publicar un trabajo no depende del broker');
  } finally { sh('docker compose start rabbitmq'); }
  const delivered = await waitFor(async () => ((await stats()).events?.CO?.['job.created'] || 0) >= before + 1, 90000);
  assert.ok(delivered, 'el evento pendiente debe entregarse cuando el broker vuelve');
});
