# Security guide — Fast Equb

## What we protect against

| Threat | Protection |
|--------|------------|
| Steal someone else's balance | Join/claim use **session cookie**, not body `playerId` |
| Mint free money via API | Balance set/adjust is **admin-only** |
| Forge admin | Role from DB + signed session; no client `role: admin` |
| Brute-force login | Rate limit per IP + phone |
| Scanner bots | Middleware blocks wp-admin, .env, php, path traversal |
| XSS / clickjacking | CSP, X-Frame-Options DENY, nosniff |
| Session theft | httpOnly + Secure cookie, HMAC signature |

## Required Vercel secrets

```
SESSION_SECRET=<32+ random characters>
SUPABASE_SERVICE_ROLE_KEY=<never put in NEXT_PUBLIC_*>
ADMIN_PASSWORD=<strong unique password>
VERIFY_ET_API_KEY=<server only>
```

Never put service role keys or API secrets in frontend code or `NEXT_PUBLIC_*`.

## After deploy

1. Redeploy commit with security fixes
2. All users must **sign out and sign in** (new session cookie)
3. Test: join a room while signed in — must work
4. Test: call `/api/users/{any-id}/balance` without admin session — must 401/403

## Ops tips

- Rotate `SESSION_SECRET` if leaked (logs everyone out)
- Use strong unique `ADMIN_PASSWORD`
- Enable Supabase network restrictions if available
- Monitor Vercel logs for 401/429 spikes
- Keep `REAL_MONEY_ENABLED=false` until licensed
