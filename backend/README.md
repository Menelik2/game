# Backend — Fast Equb API

Source: **`apps/api`**

## What it does

- In-memory multiplayer Equb rooms (no Postgres required)
- Crypto draw every 60s when 2+ players
- CORS allows `*.vercel.app`
- Health: `GET /api/health`
- Equb: `GET/POST /api/equb/...`

## Deploy on Render (recommended)

1. New Web Service → connect `Menelik2/game`
2. Root: repo root (or use `render.yaml`)
3. Build: `npm install && npm run build --workspace=@apex/api`
4. Start: `npm run start:prod --workspace=@apex/api`
5. Env:

```
DEMO_MODE=true
CORS_ORIGINS=https://abelgame.vercel.app
APP_URL=https://abelgame.vercel.app
PORT=10000
```

Copy the public URL → set frontend `NEXT_PUBLIC_API_URL` to that URL.

## Deploy on Vercel

Root Directory: `apps/api` · Framework: Other

Env same as above. Serverless cold starts reset in-memory rooms.

## Local

```bash
cd apps/api && npm install && npm run start:dev
```

http://localhost:3001/api/health  
http://localhost:3001/api/equb/templates
