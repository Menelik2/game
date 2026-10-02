# Deploy backend (API + Equb / Ekub)

GitHub and **Vercel do not host** the NestJS API.

Equb (Ekub) lives inside `apps/api`:

- HTTP: `/api/equb/*`
- WebSocket: Socket.IO namespace `/equb`
- In-memory rooms + 2s tick scheduler

You need a long-running Node host: **Render**, **Railway**, or **Docker VPS**.

## Recommended: Render Blueprint

1. Code on branch `main`: https://github.com/Menelik2/game
2. https://dashboard.render.com → **New** → **Blueprint**
3. Connect **Menelik2/game**, branch **main**
4. Uses `render.yaml` → service `apex-api` + Postgres
5. After deploy, Shell:

```bash
npm run seed --workspace=@apex/api
```

6. Copy API URL → set on Vercel:

```
NEXT_PUBLIC_API_URL=https://apex-api-xxxx.onrender.com
NEXT_PUBLIC_DEMO_MODE=true
```

7. On Render API env:

```
APP_URL=https://your-frontend.vercel.app
CORS_ORIGINS=https://your-frontend.vercel.app
DEMO_MODE=true
REAL_MONEY_ENABLED=false
```

Verify:

- `GET /api/health`
- `GET /api/equb/templates`

## Railway

1. New Project → Deploy from GitHub → Menelik2/game (`main`)
2. Add PostgreSQL (+ Redis if you use other features)
3. Env: `DEMO_MODE`, JWT secrets, `APP_URL`, `CORS_ORIGINS`, `DATABASE_URL`
4. Start: `npm run start:prod --workspace=@apex/api`
5. Seed via Railway shell
6. Point Vercel `NEXT_PUBLIC_API_URL` at the Railway public URL

## Docker VPS

```bash
git clone https://github.com/Menelik2/game.git && cd game
cp .env.example .env
# set JWT_*, APP_URL, CORS_ORIGINS, DATABASE_URL
docker compose up -d postgres redis
docker compose up -d --build api
docker compose exec api npm run seed --workspace=@apex/api
```

## Connecting the Vercel frontend

The Next.js app reads **only**:

```
NEXT_PUBLIC_API_URL=https://your-api-host
```

Do **not** append `/api`. The client already calls `${NEXT_PUBLIC_API_URL}/api/...`.

After setting env on Vercel, **redeploy** the frontend.
