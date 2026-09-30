# Fast Equb (ፋስት እቁብ)

Digital Equb-style groups inspired by Ethiopian traditional rotating savings.

**Demo mode:** virtual Birr only. No real money.

## Run

```bash
npm install
npm run dev --workspace=@apex/equb
# http://localhost:3002
```

## Vercel

- Root Directory: `apps/equb`
- Branch: `root`
- `NEXT_PUBLIC_DEMO_MODE=true`

## Rules

- Groups: 5, 10, 20 … 100
- Contribution = pot ÷ group size
- Full room → fair rotation → one recipient per round until all received
