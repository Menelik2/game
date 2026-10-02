# Apex Casino Platform

Production-oriented **social / demo casino** (virtual credits only by default).

**Repo:** https://github.com/Menelik2/game  
**Branch:** `main` (also tracked as `root` in some deploy docs)

## Demo accounts (after seed)

| Role   | Email                 | Password  |
|--------|-----------------------|-----------|
| Player | demo@apexcasino.com   | Demo123!  |
| Admin  | admin@apexcasino.com  | Admin123! |

## Local run

```bash
git clone https://github.com/Menelik2/game.git && cd game
cp .env.example .env

# Optional but recommended: ensure the web app sees the API URL
# (Next.js reads NEXT_PUBLIC_* from .env / .env.local)
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" >> .env
echo "NEXT_PUBLIC_DEMO_MODE=true" >> .env

docker compose up -d postgres redis

npm install
npm run seed --workspace=@apex/api
npm run dev          # starts API (3001) + Web (3000)
```

Or run separately:

```bash
# terminal 1
cd apps/api && npm install && npm run seed && npm run start:dev

# terminal 2
cd apps/web && npm install && npm run dev
```

- Web: http://localhost:3000
- API docs: http://localhost:3001/api/docs
- Health: http://localhost:3001/api/health

### Connection notes (local)

- The frontend calls the backend using `NEXT_PUBLIC_API_URL`.
- If unset and you are on `localhost`, it now defaults to `http://localhost:3001`.
- Backend CORS allows `APP_URL` / `CORS_ORIGINS` (default `http://localhost:3000`) and any `*.vercel.app` origin.
- If the API is down, the UI falls back to offline demo mode automatically.

## Vercel (frontend only)

1. Import repo → **Root Directory:** `apps/web`
2. **Production Branch:** `main` or `root`
3. Env vars:
   - `NEXT_PUBLIC_DEMO_MODE=true`
   - `NEXT_PUBLIC_API_URL=https://your-api-host` (no trailing slash)

API + Postgres + Redis must be hosted separately (Railway, Render, Fly.io, Docker VPS).
See `DEPLOY.md` and `docs/DEPLOY_BACKEND.md`.

## Stack

- **Web:** Next.js 15, React 19, Tailwind, TanStack Query
- **API:** NestJS, TypeORM, PostgreSQL, Redis, Socket.IO
- **Games:** Server-authoritative crypto RNG (slots, roulette, crash, blackjack, baccarat)
- **Wallet:** Double-entry ledger, idempotent bets/wins
- **Compliance-ready:** RG limits, self-exclusion, audit logs (real-money gated off)

## Structure

```
apps/api/     NestJS backend
apps/web/     Next.js frontend
packages/shared/
docker-compose.yml
```
