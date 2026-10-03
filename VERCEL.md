# Vercel deploy — Fast Equb only

## Correct project settings

| Setting | Value |
|---------|--------|
| **Framework Preset** | Next.js |
| **Root Directory** | `apps/equb` |
| **Install Command** | `npm install` (default) |
| **Build Command** | `npm run build` (default) |
| **Output Directory** | *(leave empty — Next.js default)* |

Do **not**:
- Set Root Directory to repo root with `cd apps/equb`
- Use Root Directory `apps/web` (legacy multi-game UI)
- Deploy NestJS API as a Next.js project (`game-api` will fail)

## Env (optional)

```
NEXT_PUBLIC_DEMO_MODE=true
```

## After settings change

1. Save
2. Deployments → Redeploy **main** (clear cache if needed)

Sites: `abelgame.vercel.app` / `addisbingo.vercel.app` should both use Root Directory **`apps/equb`**.
