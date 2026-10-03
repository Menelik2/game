# Backend (NestJS API)

Source code lives in **`apps/api`**.

## Vercel — Project B (Backend)

| Setting | Value |
|---------|--------|
| **Root Directory** | `apps/api` |
| Framework | Other |
| Install | `npm install` |

Serverless entry: `apps/api/api/index.ts` + `apps/api/vercel.json`

### Environment variables

```
DEMO_MODE=true
CORS_ORIGINS=https://YOUR-FRONTEND.vercel.app,https://abelgame.vercel.app
APP_URL=https://YOUR-FRONTEND.vercel.app
DATABASE_URL=postgresql://USER:PASS@HOST/DB
DATABASE_SSL=true
JWT_SECRET=long-random-secret
JWT_REFRESH_SECRET=another-long-random-secret
```

### Local

```bash
cd apps/api && npm install && npm run start:dev
```

API: http://localhost:3001/api

> Note: Full Nest + Postgres + WebSockets is more reliable on **Render** or **Railway**. Vercel serverless works for HTTP Equb routes if DB is configured.
