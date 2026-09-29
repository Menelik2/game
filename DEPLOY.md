# Deploy Apex Casino to GitHub + Vercel

## 1. Push the FULL codebase (required)

This environment can only upload some files via the GitHub API.
Your complete platform (API + web + Docker + tests) lives in the local sandbox history.

### Option A — You already have the local `game` folder with all commits

```bash
cd game
git remote set-url origin https://github.com/Menelik2/game.git
git push -u origin root --force
```

`--force` is OK if you own the repo and want the full local history to replace the partial API uploads.

Also publish `main` for Vercel defaults:

```bash
git branch -M main   # or: git checkout -b main
git push -u origin main --force
```

### Option B — Clone and you need the files from elsewhere

Ask the assistant to continue uploading remaining batches, or copy the project from the development machine that built it.

## 2. Vercel (frontend only)

**Vercel cannot host the NestJS API + Postgres.** Only the Next.js app in `apps/web`.

1. Open https://vercel.com/new
2. Import **Menelik2/game**
3. Set **Root Directory** to: `apps/web`
4. Framework: **Next.js**
5. Environment variables:
   - `NEXT_PUBLIC_API_URL` = public URL of your API (must use HTTPS in production)
   - `NEXT_PUBLIC_DEMO_MODE` = `true`
6. Deploy

Production branch: set to `root` or `main` (whichever you pushed).

## 3. Host the API separately

Examples: Railway, Render, Fly.io, or any VPS with Docker:

```bash
docker compose up -d postgres redis api
docker compose exec api npm run migration:run
docker compose exec api npm run seed
```

Then set `NEXT_PUBLIC_API_URL` on Vercel to that API’s public URL.

## Demo logins (after API seed)

- Player: `demo@apexc casino.com` / `Demo123!`
- Admin: `admin@apexc casino.com` / `Admin123!`

## Repo

https://github.com/Menelik2/game
