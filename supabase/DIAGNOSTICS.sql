-- CFA Hub — Diagnostics (copy/paste in Supabase SQL editor)
-- Goal: detect "wrong project" vs "RLS/owner_id" issues without screenshots.

-- 1) Quick existence check
select
  to_jsonb(x) as table_health
from (
  select
    t.table_name,
    -- total rows (will error if no perms; in SQL editor you should have perms)
    (select count(*) from public."" || t.table_name || "" ) as total_rows
  from (
    values
      ('documents'),
      ('flashcard_sets'),
      ('quiz_sets'),
      ('exercise_sets'),
      ('profiles'),
      ('library_folders')
  ) as t(table_name)
) x;

-- NOTE: The above uses dynamic SQL style that doesn't work directly in plain SELECT.
-- Use the block below instead.

-- 2) Table snapshots (safe, no auth required)
-- Replace / add tables as needed.

-- Documents
select
  'documents' as table,
  (select count(*) from public.documents) as total_rows,
  (select count(*) from public.documents where owner_id is null) as owner_id_null,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='documents' and column_name='owner_id'
  ) as has_owner_id,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='documents' and column_name='user_id'
  ) as has_user_id,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='documents' and column_name='created_by'
  ) as has_created_by,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='documents' and column_name='visibility'
  ) as has_visibility
;

-- Flashcard sets
select
  'flashcard_sets' as table,
  (select count(*) from public.flashcard_sets) as total_rows,
  (select count(*) from public.flashcard_sets where owner_id is null) as owner_id_null,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='flashcard_sets' and column_name='owner_id'
  ) as has_owner_id,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='flashcard_sets' and column_name='user_id'
  ) as has_user_id,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='flashcard_sets' and column_name='created_by'
  ) as has_created_by,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='flashcard_sets' and column_name='visibility'
  ) as has_visibility
;

-- Quiz sets
select
  'quiz_sets' as table,
  (select count(*) from public.quiz_sets) as total_rows,
  (select count(*) from public.quiz_sets where owner_id is null) as owner_id_null,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quiz_sets' and column_name='owner_id'
  ) as has_owner_id,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quiz_sets' and column_name='user_id'
  ) as has_user_id,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quiz_sets' and column_name='created_by'
  ) as has_created_by,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quiz_sets' and column_name='visibility'
  ) as has_visibility,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quiz_sets' and column_name='is_official'
  ) as has_is_official
;

-- 3) RLS status and policies count
select
  c.relname as table,
  c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relkind='r'
  and c.relname in ('documents','flashcard_sets','quiz_sets','exercise_sets')
order by c.relname;

-- Interpretation:
-- - If total_rows = 0 for all content tables => you are likely pointing the app to another Supabase project.
-- - If total_rows > 0 but owner_id_null is high OR policy_count=0 with rls_enabled=true => RLS/owner_id misalignment.
