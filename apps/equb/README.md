# Fast Equb (ፋስት እቁብ)

Digital Equb rooms inspired by Ethiopian ROSCA savings circles.
**Demo only** — virtual Birr. Not real money.

## Flow

1. Pick room (size 5–100, prize tiers)
2. Contribution = prize ÷ group size
3. Pick unique number
4. Full room → CSPRNG draws one winner
5. Winner takes the pot

## Run

```bash
cd apps/equb && npm install && npm run dev
# http://localhost:3002
```

## Vercel

- Root Directory: `apps/equb`
- `NEXT_PUBLIC_API_URL` = API base (optional; empty = solo demo)

## API (`apps/api` EqubModule)

`/api/equb/templates` · `/rooms` · `join` · `draw` · WebSocket `/equb`
