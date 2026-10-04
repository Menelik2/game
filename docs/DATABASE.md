# Database (optional)

Equb multiplayer works **in-memory** without Postgres.

## Env

```
DATABASE_URL=postgresql://USER:PASS@HOST/DB?sslmode=require
DATABASE_SSL=true
```

Use Neon or Supabase. Cloud hosts need SSL (auto-enabled for non-localhost).

## Health

`GET /api/health` returns:

```json
{
  "database": {
    "configured": true,
    "connected": true
  }
}
```

If `connected: false`, the `error` field shows the reason (SSL, auth, timeout).

## Supabase schema

Run `supabase/migrations/20261002_equb_full.sql` in the SQL editor for Equb tables.
