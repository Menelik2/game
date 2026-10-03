# Frontend (Fast Equb)

Source code lives in **`apps/equb`**.

## Vercel — Project A (Frontend)

| Setting | Value |
|---------|--------|
| **Root Directory** | `apps/equb` |
| Framework | Next.js |
| Install | `npm install` |
| Build | `npm run build` |

### Environment variables

```
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND.vercel.app
```

- No trailing slash on the API URL
- After changing env → **Redeploy** frontend

### Local

```bash
cd apps/equb && npm install && npm run dev
```

Open http://localhost:3002
