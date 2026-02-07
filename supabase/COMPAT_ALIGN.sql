-- CFA Hub — Compatibility aligner
-- Purpose: align existing DB schema/data to what the app expects (owner_id + visibility + basic RLS).
-- Safe to run multiple times.

create extension if not exists pgcrypto;

-- Helper: ensure touch_updated_at exists (used by several scripts)
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ===============
-- 1) owner_id backfill (documents, flashcards, quizzes)
-- ===============

do $$
begin
  -- documents
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='documents') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='owner_id') then
      execute 'alter table public.documents add column owner_id uuid';
    end if;

    -- Backfill owner_id from common legacy columns
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='user_id') then
      execute 'update public.documents set owner_id = coalesce(owner_id, user_id) where owner_id is null';
    elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='created_by') then
      execute 'update public.documents set owner_id = coalesce(owner_id, created_by) where owner_id is null';
    elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='profile_id') then
      execute 'update public.documents set owner_id = coalesce(owner_id, profile_id) where owner_id is null';
    end if;

    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='visibility') then
      execute "alter table public.documents add column visibility text not null default 'private'";
    else
      execute "update public.documents set visibility = 'private' where visibility is null";
    end if;
  end if;

  -- flashcard_sets
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='flashcard_sets') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='flashcard_sets' and column_name='owner_id') then
      execute 'alter table public.flashcard_sets add column owner_id uuid';
    end if;

    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='flashcard_sets' and column_name='user_id') then
      execute 'update public.flashcard_sets set owner_id = coalesce(owner_id, user_id) where owner_id is null';
    elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='flashcard_sets' and column_name='created_by') then
      execute 'update public.flashcard_sets set owner_id = coalesce(owner_id, created_by) where owner_id is null';
    elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='flashcard_sets' and column_name='profile_id') then
      execute 'update public.flashcard_sets set owner_id = coalesce(owner_id, profile_id) where owner_id is null';
    end if;

    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='flashcard_sets' and column_name='visibility') then
      execute "alter table public.flashcard_sets add column visibility text not null default 'private'";
    else
      execute "update public.flashcard_sets set visibility = 'private' where visibility is null";
    end if;
  end if;

  -- quiz_sets
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='quiz_sets') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='quiz_sets' and column_name='owner_id') then
      execute 'alter table public.quiz_sets add column owner_id uuid';
    end if;

    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='quiz_sets' and column_name='user_id') then
      execute 'update public.quiz_sets set owner_id = coalesce(owner_id, user_id) where owner_id is null';
    elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='quiz_sets' and column_name='created_by') then
      execute 'update public.quiz_sets set owner_id = coalesce(owner_id, created_by) where owner_id is null';
    elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='quiz_sets' and column_name='profile_id') then
      execute 'update public.quiz_sets set owner_id = coalesce(owner_id, profile_id) where owner_id is null';
    end if;

    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='quiz_sets' and column_name='visibility') then
      execute "alter table public.quiz_sets add column visibility text not null default 'private'";
    else
      execute "update public.quiz_sets set visibility = 'private' where visibility is null";
    end if;
  end if;
end $$;

-- ===============
-- 2) Basic RLS policies (owner/private/public/groups)
-- These match the app's expectations (it relies on RLS, not explicit owner filters).
-- ===============

do $$
begin
  -- documents
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='documents') then
    execute 'alter table public.documents enable row level security';

    -- select
    begin
      execute $pol$
        create policy documents_select_visible
        on public.documents
        for select
        to authenticated
        using (
          owner_id = auth.uid()
          or visibility = 'public'
          or (
            visibility in ('groups','group','shared')
            and exists (
              select 1
              from public.document_shares s
              join public.group_memberships gm on gm.group_id = s.group_id
              where s.document_id = documents.id
                and gm.user_id = auth.uid()
            )
          )
        )
      $pol$;
    exception when duplicate_object then null; end;

    -- insert/update/delete (owner)
    begin
      execute $pol$
        create policy documents_insert_own
        on public.documents
        for insert
        to authenticated
        with check (owner_id = auth.uid())
      $pol$;
    exception when duplicate_object then null; end;

    begin
      execute $pol$
        create policy documents_update_own
        on public.documents
        for update
        to authenticated
        using (owner_id = auth.uid())
        with check (owner_id = auth.uid())
      $pol$;
    exception when duplicate_object then null; end;

    begin
      execute $pol$
        create policy documents_delete_own
        on public.documents
        for delete
        to authenticated
        using (owner_id = auth.uid())
      $pol$;
    exception when duplicate_object then null; end;
  end if;

  -- flashcard_sets
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='flashcard_sets') then
    execute 'alter table public.flashcard_sets enable row level security';

    begin
      execute $pol$
        create policy flashcard_sets_select_visible
        on public.flashcard_sets
        for select
        to authenticated
        using (
          owner_id = auth.uid()
          or visibility = 'public'
          or (
            visibility in ('groups','group','shared')
            and exists (
              select 1
              from public.flashcard_set_shares s
              join public.group_memberships gm on gm.group_id = s.group_id
              where s.set_id = flashcard_sets.id
                and gm.user_id = auth.uid()
            )
          )
        )
      $pol$;
    exception when duplicate_object then null; end;

    begin
      execute $pol$
        create policy flashcard_sets_insert_own
        on public.flashcard_sets
        for insert
        to authenticated
        with check (owner_id = auth.uid())
      $pol$;
    exception when duplicate_object then null; end;

    begin
      execute $pol$
        create policy flashcard_sets_update_own
        on public.flashcard_sets
        for update
        to authenticated
        using (owner_id = auth.uid())
        with check (owner_id = auth.uid())
      $pol$;
    exception when duplicate_object then null; end;

    begin
      execute $pol$
        create policy flashcard_sets_delete_own
        on public.flashcard_sets
        for delete
        to authenticated
        using (owner_id = auth.uid())
      $pol$;
    exception when duplicate_object then null; end;
  end if;

  -- quiz_sets
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='quiz_sets') then
    execute 'alter table public.quiz_sets enable row level security';

    begin
      execute $pol$
        create policy quiz_sets_select_visible
        on public.quiz_sets
        for select
        to authenticated
        using (
          owner_id = auth.uid()
          or visibility = 'public'
          or (
            visibility in ('groups','group','shared')
            and exists (
              select 1
              from public.quiz_set_shares s
              join public.group_memberships gm on gm.group_id = s.group_id
              where s.set_id = quiz_sets.id
                and gm.user_id = auth.uid()
            )
          )
        )
      $pol$;
    exception when duplicate_object then null; end;

    begin
      execute $pol$
        create policy quiz_sets_insert_own
        on public.quiz_sets
        for insert
        to authenticated
        with check (owner_id = auth.uid())
      $pol$;
    exception when duplicate_object then null; end;

    begin
      execute $pol$
        create policy quiz_sets_update_own
        on public.quiz_sets
        for update
        to authenticated
        using (owner_id = auth.uid())
        with check (owner_id = auth.uid())
      $pol$;
    exception when duplicate_object then null; end;

    begin
      execute $pol$
        create policy quiz_sets_delete_own
        on public.quiz_sets
        for delete
        to authenticated
        using (owner_id = auth.uid())
      $pol$;
    exception when duplicate_object then null; end;
  end if;
end $$;

-- ===============
-- 3) Post-run sanity snapshot
-- ===============
select 'documents' as table, count(*) total, count(*) filter (where owner_id is null) owner_id_null from public.documents
union all
select 'flashcard_sets', count(*), count(*) filter (where owner_id is null) from public.flashcard_sets
union all
select 'quiz_sets', count(*), count(*) filter (where owner_id is null) from public.quiz_sets;
