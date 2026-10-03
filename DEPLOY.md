# Deploy everything (UI + API + Equb)

Nest API **cannot** run on Vercel (serverless). Full stack uses **two hosts**:

```
Browser  →  Vercel (Next.js Games + Fast Equb UI)
               │
               │  NEXT_PUBLIC_API_URL=https://apex-api-xxxx.onrender.com
               ▼
         Render (Nest API + Equb + Postgres)
```

| Component | Host | Config |
|-----------|------|--------|
| UI / Games / Equb pages | **Vercel** | `apps/web` or repo root + `vercel.json` |
| API, Equb server, auth, wallet | **Render** | `render.yaml` |
| Database | **Render Postgres** | created by blueprint |

---

## 1) Deploy API + database (Render)

1. Go to https://dashboard.render.com → **New** → **Blueprint**
2. Connect GitHub **Menelik2/game**, branch **main**
3. Confirm services: **apex-api** + **apex-postgres**
4. Apply (first deploy can take 5–10 minutes on free tier)
5. Open the service URL, e.g. `https://apex-api-xxxx.onrender.com`
6. Check health:

```text
https://YOUR-API.onrender.com/api/health
https://YOUR-API.onrender.com/api/equb/templates
https://YOUR-API.onrender.com/api/equb/ping
```

7. **Seed demo users** (Render → apex-api → Shell):

```bash
npm run seed --workspace=@apex/api
```

8. Env already set by `render.yaml`:

| Key | Purpose |
|-----|--------|
| `SYNC_DB=true` | Auto-create tables (demo) |
| `DATABASE_SSL=true` | Render Postgres |
| `CORS_ORIGINS` | Allows `abelgame.vercel.app` + `*.vercel.app` |
| `DEMO_MODE=true` | Virtual credits only |

Update `APP_URL` / `CORS_ORIGINS` if your Vercel domain is different.

**Free tier note:** Render spins down after idle; first request may be slow (cold start).

---

## 2) Deploy UI (Vercel)

1. https://vercel.com/new → import **Menelik2/game**
2. **Root Directory:** `apps/web` *(recommended)* or leave empty
3. **Framework:** Next.js
4. Environment variables:

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-API.onrender.com` (no trailing slash) |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |

5. Deploy

Rooms page should show **LIVE API** when the Nest service is reachable.

---

## 3) Connect checklist

- [ ] `GET /api/health` → `status: ok`
- [ ] `GET /api/equb/templates` → list of rooms
- [ ] Vercel `NEXT_PUBLIC_API_URL` = API origin only
- [ ] Render `CORS_ORIGINS` includes your Vercel URL
- [ ] Hard refresh the site; Network tab shows calls to Render

---

## Demo accounts (after seed)

| Role | Email | Password |
|------|-------|----------|
| Player | demo@apexcasino.com | Demo123! |
| Admin | admin@apexcasino.com | Admin123! |

Fast Equb also supports **name-only register** (local + live join with `playerId`).

---

## Alternative: Docker (all local / one VPS)

```bash
git clone https://github.com/Menelik2/game.git && cd game
cp .env.example .env
# set JWT secrets, APP_URL, CORS_ORIGINS
docker compose up -d --build
docker compose exec api npm run seed --workspace=@apex/api
```

- Web: http://localhost:3000  
- API: http://localhost:3001/api/health  
- Docs: http://localhost:3001/api/docs  

---

## Why not “all on Vercel”?

- Nest is a **long-running** process  
- Equb uses **Socket.IO** + **in-memory rooms** + **setInterval**  
- Vercel serverless functions are short-lived and have no sticky WebSockets for this stack  

UI → Vercel. API → Render. That is the supported production layout.
