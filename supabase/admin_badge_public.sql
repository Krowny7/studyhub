-- CFA Hub — Make admin badge public + helper function
-- Apply after supabase/leveling.sql

-- Allow everyone (authenticated) to read who is admin (badge display)
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='app_admins' and policyname='app_admins_select_self'
  ) then
    drop policy app_admins_select_self on public.app_admins;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='app_admins' and policyname='app_admins_select_all'
  ) then
    create policy app_admins_select_all
      on public.app_admins
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- Helper: is a given user an admin?
create or replace function public.is_user_app_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.app_admins a where a.user_id = p_user_id
  );
$$;
