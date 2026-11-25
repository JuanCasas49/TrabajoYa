// Pruebas de LOCALIZACIÓN y aislamiento por región. Requiere el sistema arriba: docker compose up --build
import test from 'node:test';
import assert from 'node:assert/strict';

const GW = process.env.GATEWAY_URL || 'http://localhost:8080';
const EXPECT = {
  CO: { currency: 'COP', lang: 'es', tz: 'America/Bogota' },
  US: { currency: 'USD', lang: 'en', tz: 'America/New_York' },
  BR: { currency: 'BRL', lang: 'pt', tz: 'America/Sao_Paulo' },
  FR: { currency: 'EUR', lang: 'fr', tz: 'Europe/Paris' },
  DE: { currency: 'EUR', lang: 'de', tz: 'Europe/Berlin' },
};
const stamp = Date.now();
const sessions = {};
const json = { 'Content-Type': 'application/json' };
const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

test('el gateway publica las 5 regiones y todas están disponibles', async () => {
  const get = async () => (await fetch(`${GW}/api/regions`)).json();
  for (let i = 0; i < 40 && !(await get()).every((r) => r.up); i++) await new Promise((r) => setTimeout(r, 1000)); // espera el arranque
  const list = await get();
  assert.deepEqual(list.map((r) => r.code).sort(), Object.keys(EXPECT).sort());
  for (const r of list) assert.ok(r.up, `la región ${r.code} no está disponible`);
});

for (const [code, exp] of Object.entries(EXPECT)) {
  test(`región ${code}: moneda ${exp.currency}, idioma ${exp.lang}, usuario y trabajo locales`, async () => {
    const meta = await fetch(`${GW}/${code}/api/meta`);
    assert.equal(meta.headers.get('x-region'), code, 'el gateway debe enrutar a la región correcta');
    const { region } = await meta.json();
    assert.deepEqual([region.currency, region.lang, region.tz], [exp.currency, exp.lang, exp.tz]);

    const reg = await fetch(`${GW}/${code}/api/auth/register`, {
      method: 'POST', headers: json,
      body: JSON.stringify({ name: `Test ${code}`, email: `t${stamp}.${code}@example.com`, password: 'password123', city: 'Ciudad' }),
    });
    assert.equal(reg.status, 201);
    const { token, user } = await reg.json();
    assert.equal(user.country_code, code, 'el usuario pertenece a la región donde se registró');
    sessions[code] = token;

    const fd = new FormData();
    Object.entries({ category_slug: 'plumbing', title: `Trabajo ${code} ${stamp}`, description: 'Descripción de prueba del trabajo',
      city: 'Ciudad', budget: '100', estimated_date: inDays(2) }).forEach(([k, v]) => fd.append(k, v));
    const created = await fetch(`${GW}/${code}/api/jobs`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    assert.equal(created.status, 201);
    const job = await created.json();
    assert.equal(job.currency, exp.currency, 'la moneda del trabajo la fija la región');
    assert.equal(job.country_code.trim(), code);
  });
}

test('aislamiento de datos: un trabajo de CO no existe en DE ni en US', async () => {
  for (const other of ['DE', 'US']) {
    const list = await (await fetch(`${GW}/${other}/api/jobs?q=${encodeURIComponent(`Trabajo CO ${stamp}`)}`, {
      headers: { Authorization: `Bearer ${sessions[other]}` } })).json();
    assert.equal(list.length, 0);
  }
  const own = await (await fetch(`${GW}/CO/api/jobs?q=${encodeURIComponent(`Trabajo CO ${stamp}`)}`, {
    headers: { Authorization: `Bearer ${sessions.CO}` } })).json();
  assert.equal(own.length, 1);
});

test('un token de una región no sirve en otra (identidad local por región)', async () => {
  const r = await fetch(`${GW}/DE/api/jobs/mine`, { headers: { Authorization: `Bearer ${sessions.CO}` } });
  // Comparten JWT_SECRET en desarrollo, pero el usuario no existe en la BD de DE: no ve datos ajenos
  const body = await r.json();
  assert.ok(r.status === 401 || (body.posted?.length === 0 && body.applied?.length === 0));
});
