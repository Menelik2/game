# Frontend env (Vercel)

```
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND.vercel.app
```

`NEXT_PUBLIC_API_URL` must be the **backend** deployment URL with **no** trailing slash and **no** `/api` suffix.

Example:

```
NEXT_PUBLIC_API_URL=https://game-api-xxx.vercel.app
```

Frontend will call: `https://game-api-xxx.vercel.app/api/equb/...`
