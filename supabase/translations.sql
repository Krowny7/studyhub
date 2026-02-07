-- CFA Hub — Translations for content (EN/FR)
-- Goal: keep content readable in both French and English, for both:
-- - official/reference content (admins)
-- - user-generated content (owners)
--
-- Design:
-- - Base content stays in the main tables (quiz_sets, quiz_questions, exercise_sets, exercises).
-- - Optional translations are stored in a single table keyed by (content_type, content_id, lang).
-- - Read: authenticated users.
-- - Write: admins or owners (via RPC below).

create table if not exists public.content_translations (
  content_type text not null, -- 'quiz_set' | 'quiz_question' | 'exercise_set' | 'exercise' | 'flashcard_set' | 'flashcard'
  content_id uuid not null,
  lang text not null,         -- 'fr' | 'en'
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (content_type, content_id, lang)
);

create index if not exists content_translations_lookup_idx
  on public.content_translations (content_type, content_id, lang);

alter table public.content_translations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='content_translations' and policyname='content_translations_select'
  ) then
    create policy content_translations_select
      on public.content_translations
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='content_translations' and policyname='content_translations_admin_write'
  ) then
    create policy content_translations_admin_write
      on public.content_translations
      for all
      to authenticated
      using (public.is_app_admin())
      with check (public.is_app_admin());
  end if;
end $$;

-- Ownership helper: used by the RPC to allow users to write translations for their own content.
create or replace function public.is_content_owner(
  p_content_type text,
  p_content_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    case
      when auth.uid() is null then false
      when public.is_app_admin() then true

      when p_content_type = 'quiz_set' then
        exists (select 1 from public.quiz_sets s where s.id = p_content_id and s.owner_id = auth.uid())
      when p_content_type = 'quiz_question' then
        exists (
          select 1
          from public.quiz_questions q
          join public.quiz_sets s on s.id = q.set_id
          where q.id = p_content_id and s.owner_id = auth.uid()
        )

      when p_content_type = 'exercise_set' then
        exists (select 1 from public.exercise_sets s where s.id = p_content_id and s.owner_id = auth.uid())

      when p_content_type = 'flashcard_set' then
        exists (select 1 from public.flashcard_sets s where s.id = p_content_id and s.owner_id = auth.uid())
      when p_content_type = 'flashcard' then
        exists (
          select 1
          from public.flashcards c
          join public.flashcard_sets s on s.id = c.set_id
          where c.id = p_content_id and s.owner_id = auth.uid()
        )

      else false
    end;
$$;

-- Upsert helper (admin OR owner)
create or replace function public.upsert_content_translation(
  p_content_type text,
  p_content_id uuid,
  p_lang text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_content_owner(p_content_type, p_content_id) then
    raise exception 'Not allowed';
  end if;

  insert into public.content_translations (content_type, content_id, lang, payload, updated_at)
  values (p_content_type, p_content_id, p_lang, coalesce(p_payload, '{}'::jsonb), now())
  on conflict (content_type, content_id, lang)
  do update set payload = excluded.payload, updated_at = now();
end;
$$;
