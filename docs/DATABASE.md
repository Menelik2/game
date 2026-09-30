# Database (PostgreSQL)

GitHub stores **schema + migrations + seed scripts**, not live data.

## On GitHub (this repo)

| Path | Purpose |
|------|---------|
| `apps/api/src/database/migrations/1730000000000-InitialSchema.ts` | Creates all tables |
| `apps/api/src/database/seeds/run-seed.ts` | Demo users, wallets, games (incl. Fast Keno) |
| `apps/api/src/database/data-source.ts` | TypeORM connection for migrations |

## Live database (not on GitHub)

Create Postgres on **Render**, **Railway**, or **Docker**, then:

```bash
# apply schema
npm run migration:run --workspace=@apex/api

# load demo data
npm run seed --workspace=@apex/api
```

## Seed accounts

| Role | Email | Password |
|------|-------|----------|
| Player | demo@apexcasino.com | Demo123! |
| Admin | admin@apexcasino.com | Admin123! |

Default demo credits: 10000 (`SEED_DEMO_CREDITS`)

## Tables (summary)

- users, user_profiles
- wallets, ledger_entries, transactions
- games, game_providers, game_sessions, game_rounds, favorites
- bonuses, user_bonuses
- responsible_gaming_limits, self_exclusions
- audit_logs, fraud_events
