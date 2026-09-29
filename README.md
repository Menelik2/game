# Apex Casino Platform

Production-grade social & regulated casino gaming platform.

**DEMO MODE by default** — virtual credits only. No real-money processing until licensed.

## Quick start

```bash
git clone https://github.com/Menelik2/game.git
cd game
cp .env.example .env
docker compose up -d --build
docker compose exec api npm run migration:run
docker compose exec api npm run seed
```

- Web: http://localhost:3000
- API docs: http://localhost:3001/api/docs

Demo login: `demo@apexc casino.com` / `Demo123!`

Full source is developed locally on branch `root`. Push from your machine to publish all commits:

```bash
git push -u origin root
```

See `docs/ARCHITECTURE.md` and `docs/LOCAL_DEV.md`.
