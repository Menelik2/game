# Deploy guide

## Frontend → Vercel

1. [vercel.com/new](https://vercel.com/new) → Import `Menelik2/game`
2. **Root Directory:** `apps/web`
3. **Production Branch:** `root`
4. Environment variables:
   - `NEXT_PUBLIC_DEMO_MODE=true`
   - `NEXT_PUBLIC_API_URL=https://your-api-host`

## Backend → Railway / Render / Fly / VPS

Requires:
- PostgreSQL
- Redis
- Node 20+

```bash
cd apps/api
npm install
npm run migration:run   # or seed with synchronize in demo
npm run seed
npm run start:prod
```

Env (see `.env.example`):
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET` / `JWT_REFRESH_SECRET`
- `DEMO_MODE=true`
- `REAL_MONEY_ENABLED=false`
- `APP_URL` (frontend origin for CORS)

## Important

Vercel hosts **only** the Next.js UI. The NestJS API cannot run on Vercel as a full long-lived server with WebSockets + Postgres workers without a separate host.
