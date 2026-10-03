# Fast Equb (ፋስት እቁብ)

**Only game:** Ethiopian Equb-style number rooms.

- Virtual Birr demo credits
- Group sizes 5–100
- Crypto random draw · one winner per round
- Amharic + English
- Ethiopian calendar + Birr unit

Keno, Blackjack, slots, baccarat and other casino games are **out of product scope**.

## Deploy (Vercel)

| Setting | Value |
|---------|--------|
| Root Directory | `apps/equb` |
| Framework | Next.js |
| Build | `npm run build` |

Optional env: `NEXT_PUBLIC_DEMO_MODE=true`

## Local

```bash
cd apps/equb && npm install && npm run dev
```

http://localhost:3002
