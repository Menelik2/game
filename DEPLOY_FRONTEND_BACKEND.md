# Deploy Frontend + Backend on Vercel (communicate)

Same GitHub repo → **two Vercel projects**.

```
Menelik2/game
├─ apps/equb   ← FRONTEND (Next.js)  → Vercel Project A
└─ apps/api    ← BACKEND  (NestJS)   → Vercel Project B
```

Docs folders: `frontend/` and `backend/` (how to deploy).

---

## 1) Backend (Project B)

1. Vercel → New Project → `Menelik2/game`
2. **Root Directory:** `apps/api`
3. Framework: **Other**
4. Env:

| Name | Value |
|------|--------|
| `DEMO_MODE` | `true` |
| `CORS_ORIGINS` | `https://abelgame.vercel.app` |
| `APP_URL` | `https://abelgame.vercel.app` |
| `DATABASE_URL` | Postgres connection string |
| `DATABASE_SSL` | `true` |
| `JWT_SECRET` | long random |
| `JWT_REFRESH_SECRET` | long random |

5. Deploy → copy URL e.g. `https://game-backend-xxx.vercel.app`

---

## 2) Frontend (Project A)

1. Vercel project **abelgame** (or new)
2. **Root Directory:** `apps/equb`
3. Framework: **Next.js**
4. Env:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_DEMO_MODE` | `true` |
| `NEXT_PUBLIC_API_URL` | `https://game-backend-xxx.vercel.app` |

5. Deploy / Redeploy

---

## 3) How they communicate

```
Browser (abelgame.vercel.app)
    |
    |  fetch(NEXT_PUBLIC_API_URL + '/api/equb/...')
    v
Backend (game-backend-xxx.vercel.app)
    |
    |  CORS allows abelgame.vercel.app
    v
Postgres (DATABASE_URL)
```

Checklist:

- [ ] Frontend has `NEXT_PUBLIC_API_URL` = backend URL (no `/api` at end)
- [ ] Backend has `CORS_ORIGINS` = frontend URL
- [ ] Redeploy **both** after env changes
- [ ] Backend has working `DATABASE_URL`

Without `NEXT_PUBLIC_API_URL`, frontend runs **solo demo** (local virtual Birr only).

---

## Alternative (recommended for API)

Backend on **Render** / **Railway** (always-on Nest), frontend on Vercel only.  
Same env link: `NEXT_PUBLIC_API_URL` + `CORS_ORIGINS`.
