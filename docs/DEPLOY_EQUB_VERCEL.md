# Deploy Fast Equb to Vercel

Code is on GitHub: https://github.com/Menelik2/game (branch **root**)

## Steps

1. Open https://vercel.com/new
2. Connect GitHub → select **Menelik2/game**
3. Configure:
   | Field | Value |
   |-------|--------|
   | Framework | Next.js |
   | Root Directory | **apps/equb** |
   | Production Branch | **root** |
4. Env (optional): `NEXT_PUBLIC_DEMO_MODE=true`
5. Click **Deploy**

Your site will be at `https://something.vercel.app`

## Note

Do **not** use Root Directory `apps/web` for Equb — that is the casino frontend.
Fast Equb is only under `apps/equb`.
