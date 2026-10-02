# Supabase — Fast Equb full database

## Setup

1. Create a project at https://supabase.com
2. **SQL Editor** → run `migrations/20261002_equb_full.sql`
3. Enable Email auth (or preferred provider)
4. **Replication**: `equb_rounds`, `equb_seats`, `wallets`
5. Env:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## Tables

profiles · wallets · ledger_entries · equb_templates · equb_rounds · equb_seats · audit_logs

## RPCs

- `equb_ensure_open_round(template_id)`
- `equb_join_round(template_id, pick, display_name)` — debits wallet
- `equb_draw_round(round_id)` — CSPRNG-style draw + credit winner + next round
- `equb_process_due_rounds()` — call every minute (service role / pg_cron)

## Unlimited rounds

Draw opens the next open round for the same template. Join again if balance ≥ contribution.

Demo only — virtual Birr, not real money.
