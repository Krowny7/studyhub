-- Admin tools for "referenced" (official) QCM + Exercises
-- Safe to run multiple times.

-- 1) Exercise sets: add official columns (mirrors quiz_sets)
alter table if exists public.exercise_sets
  add column if not exists is_official boolean not null default false,
  add column if not exists official_published boolean not null default false,
  add column if not exists difficulty smallint not null default 1,
  add column if not exists published_at timestamptz;

create index if not exists exercise_sets_official_idx
  on public.exercise_sets (is_official, official_published, published_at desc);

create index if not exists quiz_sets_official_idx
  on public.quiz_sets (is_official, official_published, published_at desc);

-- 2) RLS: allow app admins to manage any content (update/insert/delete)
-- Note: is_app_admin() is defined in supabase/leveling.sql

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_sets' and polname='quiz_sets_admin_update') then
    create policy quiz_sets_admin_update
      on public.quiz_sets for update
      to authenticated
      using (public.is_app_admin())
      with check (public.is_app_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_sets' and polname='quiz_sets_admin_insert') then
    create policy quiz_sets_admin_insert
      on public.quiz_sets for insert
      to authenticated
      with check (public.is_app_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_sets' and polname='quiz_sets_admin_delete') then
    create policy quiz_sets_admin_delete
      on public.quiz_sets for delete
      to authenticated
      using (public.is_app_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='exercise_sets' and polname='exercise_sets_admin_update') then
    create policy exercise_sets_admin_update
      on public.exercise_sets for update
      to authenticated
      using (public.is_app_admin())
      with check (public.is_app_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='exercise_sets' and polname='exercise_sets_admin_insert') then
    create policy exercise_sets_admin_insert
      on public.exercise_sets for insert
      to authenticated
      with check (public.is_app_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='exercise_sets' and polname='exercise_sets_admin_delete') then
    create policy exercise_sets_admin_delete
      on public.exercise_sets for delete
      to authenticated
      using (public.is_app_admin());
  end if;

  -- Share tables: allow admins to remove group shares when promoting to "official"
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_set_shares' and polname='quiz_set_shares_admin_delete') then
    create policy quiz_set_shares_admin_delete
      on public.quiz_set_shares for delete
      to authenticated
      using (public.is_app_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='exercise_set_shares' and polname='exercise_set_shares_admin_delete') then
    create policy exercise_set_shares_admin_delete
      on public.exercise_set_shares for delete
      to authenticated
      using (public.is_app_admin());
  end if;
end $$;
