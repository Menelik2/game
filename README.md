# Fast Equb (ፋስት እቁብ)

**Only game:** Ethiopian Equb-style number rooms.

| Path | Role |
|------|------|
| `apps/equb` | **Frontend** (Vercel Root Directory) |
| `apps/api` | **Backend** API (Vercel / Render) |
| `frontend/` | Deploy notes for frontend |
| `backend/` | Deploy notes for backend |
| `supabase/` | Optional Postgres schema |

## Deploy both on Vercel

See **[DEPLOY_FRONTEND_BACKEND.md](./DEPLOY_FRONTEND_BACKEND.md)**

1. **Frontend** project → Root: `apps/equb` → Next.js  
2. **Backend** project → Root: `apps/api` → Other  
3. Link with env: `NEXT_PUBLIC_API_URL` + `CORS_ORIGINS`

## Local frontend

```bash
cd apps/equb && npm install && npm run dev
```

http://localhost:3002
