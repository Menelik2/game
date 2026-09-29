# Apex Casino Platform

Production-oriented **social / demo casino** (virtual credits only by default).

**Repo:** https://github.com/Menelik2/game  
**Branch:** `root`

## Demo accounts (after seed)

| Role   | Email                 | Password  |
|--------|-----------------------|-----------|
| Player | demo@apexcasino.com   | Demo123!  |
| Admin  | admin@apexcasino.com  | Admin123! |

## Local run

```bash
git clone https://github.com/Menelik2/game.git && cd game
git checkout root
cp .env.example .env
docker compose up -d postgres redis

cd apps/api && npm install && npm run seed && npm run start:dev
# other terminal:
cd apps/web && npm install && npm run dev
```

- Web: http://localhost:3000
- API docs: http://localhost:3001/api/docs

## Vercel (frontend only)

1. Import repo → **Root Directory:** `apps/web`
2. **Production Branch:** `root`
3. Env: `NEXT_PUBLIC_DEMO_MODE=true`, `NEXT_PUBLIC_API_URL=<your-api-url>`

API + Postgres + Redis must be hosted separately (Railway, Render, Fly.io, Docker VPS).

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
