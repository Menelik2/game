# Scale to 500+ users — full API connection

## Architecture (correct)

```
Players (500+)
    │
    ▼
https://abelgame.vercel.app     ← ONE app: UI + API + sessions
    │
    ├── /api/auth/*             login, register, session cookie
    ├── /api/equb/rooms/*       multiplayer (Supabase shared state)
    ├── /api/wallet/*           deposits & balance
    ├── /api/admin/*            admin only
    └── Supabase Postgres       users, rooms, deposits
```

**Do not** send login to `https://game-rho-eight-15.vercel.app` — that service has no `/api/auth/login`.

Optional: keep game-rho only as a Verify.ET helper. Auth stays on abelgame.

## Vercel env (abelgame project)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SESSION_SECRET=long-random-32plus-chars
ADMIN_PHONE=+2519xxxxxxxx
ADMIN_PASSWORD=strong-secret
VERIFY_ET_API_KEY=...          # copy from game-rho if you use Telebirr verify
TELEBIRR_MERCHANT_PHONE=0977832379
TELEBIRR_MERCHANT_NAME=Menelik
NEXT_PUBLIC_APP_URL=https://abelgame.vercel.app
```

**Do not set** `NEXT_PUBLIC_API_URL` to game-rho for login.

## Supabase SQL (required once)

1. Run `supabase/schema.sql` **or** both:
   - `migrations/001_wallet_deposits.sql`
   - `migrations/002_equb_live_rooms.sql`

2. Confirm:

```
GET https://abelgame.vercel.app/api/system/status
```

`capacity.ready` should be `true`.

## Capacity notes

| Layer | 500 users |
|-------|-----------|
| Supabase free/pro | Handles 500 registered users easily |
| Vercel serverless | Scales automatically |
| Shared rooms | `equb_live_rooms` table — all players see same game |
| In-memory only | **Not** OK for multiplayer across instances |

## Check connection

```bash
curl https://abelgame.vercel.app/api/health
curl https://abelgame.vercel.app/api/system/status
curl https://abelgame.vercel.app/api/equb/rooms
```
