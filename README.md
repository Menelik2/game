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
cp .env.example .env
docker compose up -d postgres redis

cd apps/api && npm install && npm run seed && npm run start:dev
# other terminal:
cd apps/web && npm install && npm run dev
```

- Web: http://localhost:3000
- API docs: http://localhost:3001/api/docs

## Vercel

1. Import repo → **Root Directory:** `apps/web`
2. Branch: `root`
3. Env: `NEXT_PUBLIC_DEMO_MODE=true`, `NEXT_PUBLIC_API_URL=<api-url>`

API must be hosted separately (Docker / Railway / Render).

## Bugfixes (latest)

- Bonus entity uses `value` (aligned service + seed)
- Full `ERROR_CODES` in `@apex/shared`
- `creditWin(0)` no longer returns invalid transaction
- Seed emails: `*@apexcasino.com` (no space)
