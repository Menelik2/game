# Deploy backend from GitHub

GitHub does **not** host long-running APIs. Connect this repo to **Render** or **Railway**.

- Frontend: https://addisbingo.vercel.app (Vercel)
- Backend: NestJS + PostgreSQL + Redis (Render / Railway / VPS)

## Option A — Render (easiest from GitHub)

1. Ensure code is on branch `root`: https://github.com/Menelik2/game
2. Open https://dashboard.render.com → **New** → **Blueprint**
3. Connect **Menelik2/game**, select branch **root**
4. Render uses `render.yaml` to create API + Postgres + Redis
5. After deploy, copy the API URL (e.g. `https://apex-api-xxxx.onrender.com`)
6. In Render → apex-api → Shell:
   ```bash
   npm run seed --workspace=@apex/api
   ```
7. Vercel → Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://apex-api-xxxx.onrender.com
   NEXT_PUBLIC_DEMO_MODE=true
   ```
8. Redeploy Vercel.

Health: `GET /api/health`

## Option B — Railway

1. https://railway.app → New Project → Deploy from GitHub → Menelik2/game (`root`)
2. Add PostgreSQL + Redis plugins
3. Set env: DEMO_MODE, JWT secrets, APP_URL, CORS_ORIGINS, DATABASE_URL, REDIS_URL
4. Start: `npm run start:prod --workspace=@apex/api`
5. Seed via Railway shell, then set `NEXT_PUBLIC_API_URL` on Vercel

## Option C — Docker VPS

```bash
git clone https://github.com/Menelik2/game.git && cd game && git checkout root
cp .env.example .env   # set secrets
docker compose up -d postgres redis
docker compose up -d --build api
docker compose exec api npm run seed --workspace=@apex/api
```

## Important

- DEMO only by default (`REAL_MONEY_ENABLED=false`)
- Never enable real money without licenses and compliance
