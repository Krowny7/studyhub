-- Tags + Smart Views (owner-scoped)
-- Run this file in Supabase SQL editor.

create extension if not exists pgcrypto;

-- =====================
-- 1) TAGS
-- =====================

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text null,
  created_at timestamptz not null default now()
);

create unique index if not exists tags_owner_lower_name_uniq
  on public.tags(owner_id, lower(name));

alter table public.tags enable row level security;

do $$ begin
  create policy "tags_select_own" on public.tags
    for select using (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "tags_insert_own" on public.tags
    for insert with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "tags_update_own" on public.tags
    for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "tags_delete_own" on public.tags
    for delete using (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

-- =====================
-- 2) TAG JOINS
-- (owner-scoped for now)
-- =====================

create table if not exists public.document_tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(document_id, tag_id)
);

create index if not exists document_tags_owner_doc_idx on public.document_tags(owner_id, document_id);
create index if not exists document_tags_owner_tag_idx on public.document_tags(owner_id, tag_id);

alter table public.document_tags enable row level security;

do $$ begin
  create policy "document_tags_select_own" on public.document_tags
    for select using (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "document_tags_insert_own" on public.document_tags
    for insert with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "document_tags_delete_own" on public.document_tags
    for delete using (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

create table if not exists public.flashcard_set_tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null references public.flashcard_sets(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(set_id, tag_id)
);

create index if not exists flashcard_set_tags_owner_set_idx on public.flashcard_set_tags(owner_id, set_id);
create index if not exists flashcard_set_tags_owner_tag_idx on public.flashcard_set_tags(owner_id, tag_id);

alter table public.flashcard_set_tags enable row level security;

do $$ begin
  create policy "flashcard_set_tags_select_own" on public.flashcard_set_tags
    for select using (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "flashcard_set_tags_insert_own" on public.flashcard_set_tags
    for insert with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "flashcard_set_tags_delete_own" on public.flashcard_set_tags
    for delete using (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

create table if not exists public.quiz_set_tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  quiz_set_id uuid not null references public.quiz_sets(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(quiz_set_id, tag_id)
);

create index if not exists quiz_set_tags_owner_set_idx on public.quiz_set_tags(owner_id, quiz_set_id);
create index if not exists quiz_set_tags_owner_tag_idx on public.quiz_set_tags(owner_id, tag_id);

alter table public.quiz_set_tags enable row level security;

do $$ begin
  create policy "quiz_set_tags_select_own" on public.quiz_set_tags
    for select using (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "quiz_set_tags_insert_own" on public.quiz_set_tags
    for insert with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "quiz_set_tags_delete_own" on public.quiz_set_tags
    for delete using (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

-- =====================
-- 3) SAVED VIEWS
-- =====================

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('documents', 'flashcards', 'quizzes', 'exercises')),
  name text not null,
  query jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saved_views_owner_kind_lower_name_uniq
  on public.saved_views(owner_id, kind, lower(name));

alter table public.saved_views enable row level security;

do $$ begin
  create policy "saved_views_select_own" on public.saved_views
    for select using (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "saved_views_insert_own" on public.saved_views
    for insert with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "saved_views_update_own" on public.saved_views
    for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "saved_views_delete_own" on public.saved_views
    for delete using (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_saved_views on public.saved_views;
create trigger trg_touch_saved_views
before update on public.saved_views
for each row execute function public.touch_updated_at();
