# Deploy Apex Casino + Equb (Ekub)

## Important: where each part runs

| Part | Can run on Vercel? | Host on |
|------|--------------------|---------|
| **Frontend** (`apps/web` Next.js) | Yes | **Vercel** |
| **API + Equb** (`apps/api` NestJS) | **No** | **Render / Railway / Docker VPS** |

**Why Equb cannot run on Vercel**

- Equb uses **Socket.IO** (`/equb` WebSocket namespace)
- Equb uses an **in-memory room store** + `setInterval` scheduler (live rounds)
- NestJS is a **long-running** Node server, not a serverless function

Vercel is for the **UI only**. The backend (login, wallet, games, **Equb**) must be a separate always-on service.

---

## Architecture

```
Browser  →  Vercel (Next.js UI)
                │
                │  NEXT_PUBLIC_API_URL=https://your-api.onrender.com
                ▼
         Render / Railway (NestJS API + Equb + Postgres)
```

Equb HTTP routes (under API prefix `api`):

- `GET  /api/equb/templates`
- `GET  /api/equb/rooms`
- `GET  /api/equb/rooms/:id`
- `POST /api/equb/rooms/:templateId/join`
- `POST /api/equb/rooms/:roomId/draw`
- `POST /api/equb/rooms/:templateId/open`

Equb realtime: Socket.IO namespace **`/equb`** on the same API host.

---

## Step 1 — Host the API (includes Equb) on Render

1. Open https://dashboard.render.com → **New** → **Blueprint**
2. Connect GitHub repo **Menelik2/game**, branch **main**
3. Render reads `render.yaml` and creates **apex-api** + Postgres
4. After deploy, copy the API URL, e.g.  
   `https://apex-api-xxxx.onrender.com`
5. In Render → **apex-api** → **Shell**, run seed once:

```bash
npm run seed --workspace=@apex/api
```

6. Set env on the API service (if not already from blueprint):

| Key | Value |
|-----|--------|
| `DEMO_MODE` | `true` |
| `REAL_MONEY_ENABLED` | `false` |
| `APP_URL` | your Vercel URL, e.g. `https://addisbingo.vercel.app` |
| `CORS_ORIGINS` | same Vercel URL (comma-separated if multiple) |
| `JWT_SECRET` | long random string |
| `JWT_REFRESH_SECRET` | another long random string |
| `DATABASE_URL` | (from Render Postgres) |

Health check: `GET https://YOUR-API/api/health`  
Equb templates: `GET https://YOUR-API/api/equb/templates`

### Alternative: Railway or Docker VPS

```bash
git clone https://github.com/Menelik2/game.git && cd game
cp .env.example .env   # set secrets + APP_URL / CORS_ORIGINS
docker compose up -d postgres redis
docker compose up -d --build api
docker compose exec api npm run seed --workspace=@apex/api
```

---

## Step 2 — Host the frontend on Vercel

1. https://vercel.com/new → Import **Menelik2/game**
2. **Root Directory:** `apps/web`
3. **Framework:** Next.js
4. **Production Branch:** `main`
5. Environment variables:

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-API-HOST` (no trailing slash) |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |

6. Deploy

Example:

```
NEXT_PUBLIC_API_URL=https://apex-api-xxxx.onrender.com
NEXT_PUBLIC_DEMO_MODE=true
```

Redeploy after changing env vars.

---

## Step 3 — Connect frontend ↔ API (checklist)

1. API is up: open `https://YOUR-API/api/health` → `{ "status": "ok", ... }`
2. Equb is up: open `https://YOUR-API/api/equb/templates` → list of rooms
3. On **Render API**: `APP_URL` / `CORS_ORIGINS` = your exact Vercel origin  
   (e.g. `https://addisbingo.vercel.app` — no trailing slash)
4. On **Vercel**: `NEXT_PUBLIC_API_URL` = API origin only (no `/api` path)
5. Browser: hard refresh; Network tab should call  
   `https://YOUR-API/api/auth/login`, `.../api/equb/...`

CORS already allows `*.vercel.app` in the Nest bootstrap, but set `CORS_ORIGINS` to your production domain explicitly.

---

## Demo logins (after API seed)

| Role | Email | Password |
|------|-------|----------|
| Player | demo@apexcasino.com | Demo123! |
| Admin | admin@apexcasino.com | Admin123! |

---

## Local development

```bash
git clone https://github.com/Menelik2/game.git && cd game
cp .env.example .env
docker compose up -d postgres redis
npm install
npm run seed --workspace=@apex/api
npm run dev
```

- Web: http://localhost:3000  
- API: http://localhost:3001/api/docs  
- Equb: http://localhost:3001/api/equb/templates  

---

## Repo

https://github.com/Menelik2/game
