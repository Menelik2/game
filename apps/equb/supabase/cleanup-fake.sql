-- Remove fake / bot / demo rows from app_users (run in Supabase SQL Editor)

-- Demo-style ids or names (adjust if you used custom test data)
delete from public.app_users
where phone like '%000000%'
   or full_name ilike '%bot%'
   or full_name ilike '%demo%'
   or full_name ilike '%test user%'
   or referral_code like 'DEMO%';

-- Optional: reset free demo balances to 0 for players (keep admin)
-- update public.app_users set balance = 0 where role = 'player' and balance = 100;

-- New registrations should start at 0 — already set in app code.
