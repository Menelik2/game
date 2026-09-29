# Deploy Apex Casino

## Push full source from your machine (recommended)

The sandbox cannot bulk-push all ~120 files in one git operation. Your local clone has the complete history.

```bash
# On the machine where the full repo was built:
cd game
git remote -v
# should be https://github.com/Menelik2/game.git

git push -u origin root

# Optional: also publish main for Vercel default
git checkout -b main
git push -u origin main
```

If remote already has commits, merge first:

```bash
git pull origin root --allow-unrelated-histories
git push origin root
```

## Vercel (frontend only)

1. Import https://github.com/Menelik2/game
2. **Root Directory**: `apps/web`
3. Framework: Next.js
4. Environment variables:
   - `NEXT_PUBLIC_API_URL` = your API URL (e.g. Railway/Render/Fly)
   - `NEXT_PUBLIC_DEMO_MODE` = `true`
5. Deploy

**Important:** Vercel hosts the Next.js UI only. The NestJS API + Postgres + Redis must run separately (Docker Compose, Railway, Render, Fly.io, etc.).

## API (not on Vercel)

```bash
docker compose up -d postgres redis api
docker compose exec api npm run migration:run
docker compose exec api npm run seed
```

Point `NEXT_PUBLIC_API_URL` at the public API URL.
