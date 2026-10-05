-- Starting balance 100 Birr (was 5000)
alter table public.app_users alter column balance set default 100;

create or replace function public.app_register(
  p_full_name text,
  p_phone text,
  p_password_hash text
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_row public.app_users%rowtype;
begin
  if length(trim(p_full_name)) < 2 then raise exception 'FULL_NAME_REQUIRED'; end if;
  if p_phone is null or length(p_phone) < 8 then raise exception 'PHONE_INVALID'; end if;
  if p_password_hash is null or length(p_password_hash) < 16 then raise exception 'PASSWORD_INVALID'; end if;
  if exists(select 1 from public.app_users where phone = p_phone) then raise exception 'PHONE_EXISTS'; end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.app_users (full_name, phone, password_hash, balance, referral_code, role)
  values (trim(p_full_name), p_phone, p_password_hash, 100, v_code, 'player')
  returning * into v_row;

  insert into public.app_ledger (user_id, entry_type, amount, balance_after, reason)
  values (v_row.id, 'seed', 100, 100, 'registration');

  return json_build_object(
    'id', v_row.id,
    'fullName', v_row.full_name,
    'phone', v_row.phone,
    'balance', v_row.balance,
    'referralCode', v_row.referral_code,
    'role', v_row.role
  );
end;
$$;
