# Supabase SQL

## Full schema (first-time setup)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. **SQL Editor** → New query
3. Paste contents of [`schema.sql`](./schema.sql)
4. **Run**

Creates:

- `app_users` — players & admins
- `wallet_deposits` — Telebirr deposit orders (admin approve)
- `app_register` / `app_login` RPCs

## Only deposits table (if users already exist)

Run [`migrations/001_wallet_deposits.sql`](./migrations/001_wallet_deposits.sql).

## Promote an admin

```sql
update public.app_users
set role = 'admin'
where phone = '+2519xxxxxxxx';
```

## Env on Vercel

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SESSION_SECRET=long-random-secret
```
