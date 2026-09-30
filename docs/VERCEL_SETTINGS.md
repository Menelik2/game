# Vercel settings (Fast Equb + casino web)

## Why build failed

```
cd apps/web && npm install
# cd: apps/web: No such file or directory
```

This happens when **Root Directory** is already `apps/web` or `apps/equb`, but Install Command still does `cd apps/web`.

## Fast Equb (recommended)

| Setting | Value |
|---------|--------|
| Production Branch | **root** |
| Root Directory | **apps/equb** |
| Framework | Next.js |
| Install Command | `npm install` (or leave default) |
| Build Command | `npm run build` (or leave default) |
| Output Directory | leave default (`.next`) |

Optional env:

```
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
NEXT_PUBLIC_DEMO_MODE=true
```

## Casino web (apps/web)

| Setting | Value |
|---------|--------|
| Production Branch | main or root |
| Root Directory | **apps/web** |
| Install Command | `npm install` |
| Build Command | `npm run build` |

## Clear bad overrides

Project → **Settings** → **General** → **Build & Development Settings**

- Turn **Override** OFF for Install / Build if they still say `cd apps/web && ...`
- Or set Install to exactly: `npm install`

Then **Redeploy**.
