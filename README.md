# Apex Casino Platform

Production-grade social casino (DEMO mode by default — virtual credits only).

**Repo:** https://github.com/Menelik2/game  
**Branches:** `main` and `root`

## Vercel (frontend)

1. Import this repo at [vercel.com/new](https://vercel.com/new)
2. **Root Directory:** `apps/web`
3. Env:
   - `NEXT_PUBLIC_API_URL` = your API base URL
   - `NEXT_PUBLIC_DEMO_MODE` = `true`
4. Deploy

> NestJS API + Postgres cannot run on Vercel. Host API with Docker/Railway/Render.

## Local full stack

```bash
cp .env.example .env
docker compose up -d --build
# API seed after postgres is up
docker compose exec api npm run seed
```

- Web: http://localhost:3000
- API docs: http://localhost:3001/api/docs

Demo: `demo@apexc casino.com` / `Demo123!`

See [DEPLOY.md](./DEPLOY.md) for full push instructions if you need to sync remaining API source from a complete local clone.
