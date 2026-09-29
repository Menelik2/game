# Apex Casino Platform

Production-oriented **social / demo casino** (virtual credits only by default).

**Repo:** https://github.com/Menelik2/game  
**Default branch:** `root`

## Features

- Next.js frontend (premium dark UI)
- NestJS API: auth (Argon2 + JWT), double-entry wallet, game engine (crypto RNG)
- Games: slots, roulette, crash (+ blackjack/baccarat categories)
- Bonuses, favorites, admin dashboard
- Responsible gaming (limits + self-exclusion)
- WebSocket wallet updates
- TypeORM migration + seed
- Docker Compose (Postgres, Redis, API, web)
- GitHub Actions CI

## Demo accounts (after seed)

| Role   | Email                    | Password  |
|--------|--------------------------|-----------|
| Player | demo@apexc casino.com    | Demo123!  |
| Admin  | admin@apexc casino.com   | Admin123! |

## Local run

```bash
git clone https://github.com/Menelik2/game.git
cd game
cp .env.example .env

# Infra
docker compose up -d postgres redis

# API
cd apps/api && npm install
npm run seed          # creates schema (synchronize in seed) + demo data
npm run start:dev     # http://localhost:3001/api/docs

# Web (another terminal)
cd apps/web && npm install
npm run dev           # http://localhost:3000
```

Or full stack: `docker compose up -d --build`

## Vercel (frontend only)

1. Import this repo at https://vercel.com/new
2. **Root Directory:** `apps/web`
3. Production branch: `root`
4. Env:
   - `NEXT_PUBLIC_DEMO_MODE` = `true`
   - `NEXT_PUBLIC_API_URL` = public API base URL (Railway/Render/Fly/Docker host)

NestJS + Postgres **cannot** run on Vercel serverless as-is. Host the API separately.

## Safety

- `REAL_MONEY_ENABLED=false` by default
- No real deposits/withdrawals in demo mode
- Payment/KYC are interfaces only until licensed providers are connected

See [DEPLOY.md](./DEPLOY.md) and [docs/](./docs/).
