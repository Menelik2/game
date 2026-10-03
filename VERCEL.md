# Deploy on Vercel (Games / Fast Equb UI)

## What runs on Vercel

| Part | On Vercel? | Notes |
|------|------------|--------|
| **Games UI + Fast Equb** (`apps/web`) | **Yes** | Next.js — this is what Vercel builds |
| **Nest API + WebSockets** (`apps/api`) | **No** | Needs Render / Railway / Docker |

Fast Equb works **offline in the browser** (localStorage). No API required for demo play.

## Vercel project settings

1. Import repo **Menelik2/game**, branch **main**
2. **Root Directory**: leave **empty** (repo root)  
   — or set to `apps/web` (both work with current config)
3. Framework: **Next.js** (auto)
4. Env (optional):

```
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_API_URL=
```

Leave `NEXT_PUBLIC_API_URL` empty for pure demo.  
Set it only if you host Nest on Render, e.g. `https://your-api.onrender.com`

5. Deploy

## Build commands (already in `vercel.json`)

- Install: `npm install --workspace=@apex/web --include-workspace-root`
- Build: `npm run build --workspace=@apex/web`

## API (optional, not Vercel)

Nest cannot run as a long-lived Socket.IO server on Vercel serverless.  
Use **Render** blueprint (`render.yaml`) or Docker for `apps/api`.
