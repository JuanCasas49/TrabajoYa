export const GATEWAY = (process.env.EXPO_PUBLIC_GATEWAY_URL || 'http://localhost:8080').replace(/\/+$/, '');
let token = null;
let region = null;
export const setToken = (t) => { token = t; };
export const setRegion = (c) => { region = c; };
export const getRegion = () => region;
export const regionBase = () => `${GATEWAY}/${region}`;
export const imgUrl = (u) => (u.startsWith('http') ? u : `${regionBase()}${u}`);

// Catálogo de regiones con su estado (lo publica el gateway)
export async function fetchRegions() {
  const res = await fetch(`${GATEWAY}/api/regions`);
  if (!res.ok) throw new Error('No hay conexión con el servidor');
  return res.json();
}

export async function api(path, { method = 'GET', body, form } = {}) {
  if (!region) throw new Error('Elige tu país');
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form; // multipart: el navegador/RN pone el Content-Type
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch(`${regionBase()}/api${path}`, { method, headers, body: payload });
  } catch {
    throw new Error('No hay conexión con el servidor');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
