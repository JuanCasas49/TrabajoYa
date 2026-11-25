# TrabajoYa — marketplace de trabajos por días, distribuido en 5 países

Publicas un trabajo (fotos, descripción, categoría, presupuesto en la moneda de tu país, fecha) y otros usuarios envían
ofertas (monto + fecha) y chatean en tiempo real. Cada país es una **región autónoma** con su API, su base de datos,
su moneda, su idioma y su zona horaria.

## Arquitectura
```
 App (Expo: web + Android + iOS) ──► GATEWAY ──┬─► API CO ─► Postgres CO   🇨🇴 COP · es
   idioma, formato de moneda/fecha,    registro │  API US ─► Postgres US   🇺🇸 USD · en
   selector de país con estado         de       │  API BR ─► Postgres BR   🇧🇷 BRL · pt
                                       regiones │  API FR ─► Postgres FR   🇫🇷 EUR · fr
                                       + health │  API DE ─► Postgres DE   🇩🇪 EUR · de
                                       + analítica global
   API (cada región) ──outbox──► RabbitMQ ──► gateway (analítica global)
```
```
trabajoya/
├── backend/    API regional (Node + Express + Socket.IO). REGION=CO|US|BR|FR|DE decide país/moneda/idioma/zona horaria
├── gateway/    Punto de entrada: enruta /CO/... /US/..., health checks, fail-fast, WebSocket, estadísticas globales
├── frontend/   Expo (React Native + Web): 5 idiomas, formato Intl por idioma, moneda por país
├── tests/      Pruebas de localización y de falla
├── docker-compose.yml   5 regiones + 5 Postgres + RabbitMQ + gateway
└── render.yaml          Despliegue en Render (5 APIs + gateway + web)
```

### Subsistemas y middleware
| Subsistema | Dónde | Middleware / patrón |
|---|---|---|
| Identidad (registro/login, JWT) | backend/routes/auth | Cada región tiene sus usuarios |
| Marketplace (trabajos, fotos, filtros) | backend/routes/jobs | Moneda y zona horaria fijadas por la región |
| Negociación (ofertas, aceptar) | backend/routes/bids | Transacción ACID local |
| Mensajería (chat tiempo real) | backend/socket.js | Socket.IO, enrutado por el gateway |
| Eventos y analítica | backend/events.js + gateway/consumer.js | RabbitMQ + **Transactional Outbox** |
| Enrutamiento y descubrimiento | gateway | Registro de regiones + health check + fail-fast |

### Decisiones de sistema distribuido
- **Partición por país (celdas):** datos y usuarios viven en su región (localidad de datos, aislamiento de fallas, escala horizontal por país).
- **Consistencia:** fuerte dentro de una región (Postgres); entre regiones solo hay consistencia eventual vía eventos. No hay transacciones entre regiones.
- **Transparencia de ubicación:** el cliente solo conoce el gateway; `/CO/api/...` se reenvía a la región (cabecera `X-Region` lo confirma).
- **Tolerancia a fallos:** el gateway marca una región caída tras 2 health checks fallidos y responde 503 de inmediato; las demás siguen. Se recupera sola al volver.
- **Outbox:** el evento (`job.created`, `bid.placed`, `bid.accepted`) se guarda en la misma transacción que el dato; un publicador lo envía a RabbitMQ. Si el broker cae, nada se pierde: se reenvía al volver. El consumidor ignora duplicados (idempotencia).
- **Límites conocidos:** un usuario solo ve trabajos de su país; la analítica global está en memoria (se reconstruye con nuevos eventos); no se implementó saga porque no hay transacciones entre regiones (aceptar una oferta es una transacción local).

## Países, monedas e idiomas
Se definen en `backend/src/regions.js` y `gateway/src/regions.js` (mantenlos iguales):

| País | Moneda | Idioma por defecto | Zona horaria |
|---|---|---|---|
| 🇨🇴 Colombia | COP | es | America/Bogota |
| 🇺🇸 United States | USD | en | America/New_York |
| 🇧🇷 Brasil | BRL | pt | America/Sao_Paulo |
| 🇫🇷 France | EUR | fr | Europe/Paris |
| 🇩🇪 Deutschland | EUR | de | Europe/Berlin |

El idioma se propone según el país pero el usuario puede cambiarlo (es/en/pt/fr/de). Números y fechas se formatean con `Intl` según el idioma;
la **moneda** la fija el país del trabajo.

**Agregar un país:** (1) una línea en `regions.js` (backend y gateway), (2) un servicio `api-xx` + `pg-xx` en `docker-compose.yml` / `render.yaml`,
(3) `REGION_URL_XX` en el gateway. El frontend lo detecta solo. Para un idioma nuevo, agrega su bloque en `frontend/src/i18n.js`.

## 1) Ejecutar todo en local con Docker (recomendado)
Requisitos: Docker Desktop y Node 20+.
```bash
docker compose up --build        # 5 regiones + 5 Postgres + RabbitMQ + gateway
# Gateway: http://localhost:8080/api/regions   ·   RabbitMQ: http://localhost:15672 (guest/guest)
```
Frontend (otra terminal):
```bash
cd frontend
npm install
npx expo install react react-native react-native-web react-dom @expo/metro-runtime expo-image-picker @react-native-async-storage/async-storage react-native-screens react-native-safe-area-context expo-font @expo-google-fonts/plus-jakarta-sans
cp .env.example .env             # en Windows: copy .env.example .env
npx expo start                   # presiona w para la web
```
Celular: en `frontend/.env` pon `EXPO_PUBLIC_GATEWAY_URL=http://IP_DE_TU_PC:8080` y reinicia con `npx expo start -c`.

## 2) Sin Docker (usando Neon)
Una base Neon por región. Ejemplo con 2 países (cada API en su terminal):
```bash
cd backend && npm install
# .env: REGION=CO, DATABASE_URL=<neon-co>, JWT_SECRET=..., PORT=4001   → npm run migrate && npm run dev
# .env: REGION=US, DATABASE_URL=<neon-us>, JWT_SECRET=..., PORT=4002   → (otra terminal, otro .env)
cd ../gateway && npm install && cp .env.example .env   # deja solo las regiones que levantaste en REGION_URLS
npm run dev                                            # http://localhost:8080
```
(Puedes pasar las variables por terminal en vez de `.env`: `REGION=US PORT=4002 DATABASE_URL=... npm run dev`.)

## 3) Pruebas
Con el sistema Docker arriba:
```bash
cd tests
npm test                    # todas
npm run test:localization   # moneda/idioma/zona por país, datos aislados por región, identidad local
npm run test:failure        # tumba BR, la BD de DE y RabbitMQ; verifica aislamiento, recuperación y que no se pierden eventos
```
Variable opcional: `GATEWAY_URL` (por defecto `http://localhost:8080`). Las pruebas de falla usan `docker compose stop/start`.

## 4) Despliegue en Render
Arquitectura: 5 APIs + gateway (Web Services Node) + web (Static Site) en Render · 5 bases **Neon** · fotos en **Cloudinary** · RabbitMQ en **CloudAMQP** (opcional).

**Antes:**
1. **Neon:** crea 5 bases (5 proyectos, o una por región) y copia cada *connection string* (`?sslmode=require`).
2. **Cloudinary** (gratis): copia `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`.
3. **CloudAMQP** (opcional, plan gratis "Little Lemur"): copia la URL `amqps://...`. Sin ella todo funciona, solo sin eventos/analítica.
4. Sube la carpeta a GitHub (raíz del repo = donde está `render.yaml`). Haz commit de `frontend/package.json` y `package-lock.json` tras el `expo install` local.

**En Render:** *New → Blueprint* → tu repo. Completa:
- En cada `trabajoya-api-xx`: `DATABASE_URL` (la Neon de ese país), `CLOUDINARY_URL`, `AMQP_URL`.
- En `trabajoya-gateway`: `AMQP_URL` y `CORS_ORIGIN` (vacío por ahora); las `REGION_URL_XX` las llenas en el paso siguiente.
- En `trabajoya-web`: `EXPO_PUBLIC_GATEWAY_URL` vacío por ahora.

**Después del primer despliegue (orden):**
1. Copia la URL pública de cada API (`https://trabajoya-api-co.onrender.com`, …) y pégalas en `REGION_URL_CO … REGION_URL_DE` del gateway.
2. Copia la URL del gateway → `EXPO_PUBLIC_GATEWAY_URL` en `trabajoya-web` → **Manual Deploy** (se fija al compilar).
3. Copia la URL de la web → `CORS_ORIGIN` del gateway (sin `/` al final).
4. Abre la web, elige país (🟢 = disponible) y prueba.

**Importante sobre el plan gratis:** Render da ~750 horas/mes en total y cada servicio gratis cuenta; 6 servicios 24/7 no caben. Úsalo para
demos (suspende los servicios cuando no los uses) o pasa a plan *Starter*. Los servicios gratis se duermen tras ~15 min; el gateway los
despierta con sus health checks (la primera respuesta puede tardar ~1 min).

## API (todo bajo `/{PAÍS}/api`, JWT en `Authorization: Bearer ...`)
`GET /meta` · `POST /auth/register|login` · `GET /auth/me` · `GET /jobs?category=&city=&q=&min=&max=&page=` · `GET /jobs/mine|:id` ·
`POST /jobs` (multipart `images`) · `PATCH /jobs/:id/status` · `POST /jobs/:id/bids` · `POST /bids/:id/accept` ·
`POST /jobs/:id/conversation` · `GET|POST /conversations/:id/messages` · `GET /stats`.
Gateway: `GET /api/regions` (catálogo + estado) · `GET /api/global/stats` (eventos por región) · WebSocket en `/{PAÍS}/socket.io`.
