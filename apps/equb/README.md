# Fast Equb (ፋስት እቁብ)

Digital Equb groups · **virtual Birr demo only**.

## Deploy on Vercel

1. [vercel.com/new](https://vercel.com/new)
2. Import **Menelik2/game**
3. Settings:
   - **Root Directory:** `apps/equb`
   - **Branch:** `root`
   - Framework: Next.js (auto)
4. Environment variable (optional):
   - `NEXT_PUBLIC_DEMO_MODE` = `true`
5. Deploy

## Local

```bash
npm install
npm run dev --workspace=@apex/equb
# http://localhost:3002
```

## Play

1. Profile → start (5,000 virtual Birr)
2. Rooms → join (e.g. 5 players · 500 pot)
3. Fill remaining seats
4. Next payout / Run full cycle

## Rules

- Groups: 5, 10, 20 … 100
- Contribution = pot ÷ group size
- Fair rotation when room is full
