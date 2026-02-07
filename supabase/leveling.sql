-- CFA Hub — XP / Leveling (official quizzes only)
-- Apply in Supabase SQL editor.
-- Safe to run multiple times (idempotent where possible).

-- 1) Profile XP
alter table if exists public.profiles
  add column if not exists xp_total integer not null default 0;

-- 2) Admins table (for future "official content" moderation)
create table if not exists public.app_admins (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

-- Only allow an admin to see their own record (avoid leaking admin list)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='app_admins' and policyname='app_admins_select_self'
  ) then
    create policy app_admins_select_self
      on public.app_admins
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

-- Helper: is the current user an admin?
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.app_admins a where a.user_id = auth.uid()
  );
$$;

-- 3) Mark "official" quiz sets
alter table if exists public.quiz_sets
  add column if not exists is_official boolean not null default false,
  add column if not exists official_published boolean not null default false,
  add column if not exists difficulty smallint not null default 1,
  add column if not exists published_at timestamptz;

-- 4) XP events (for progress chart)
create table if not exists public.xp_events (
  id bigserial primary key,
  user_id uuid not null,
  occurred_at timestamptz not null default now(),
  xp integer not null,
  source text not null default 'quiz',
  meta jsonb not null default '{}'::jsonb
);

create index if not exists xp_events_user_time_idx on public.xp_events (user_id, occurred_at desc);

alter table public.xp_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='xp_events' and policyname='xp_events_select_own'
  ) then
    create policy xp_events_select_own
      on public.xp_events
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

-- 5) Track first correct answer per question (prevents farming XP)
create table if not exists public.quiz_question_progress (
  user_id uuid not null,
  question_id uuid not null,
  first_correct_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index if not exists quiz_question_progress_user_idx on public.quiz_question_progress (user_id);

alter table public.quiz_question_progress enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quiz_question_progress' and policyname='quiz_question_progress_select_own'
  ) then
    create policy quiz_question_progress_select_own
      on public.quiz_question_progress
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

-- 6) Award XP server-side (official quizzes only)
-- XP is granted ONLY when:
-- - the quiz set is official & published
-- - the answer is correct
-- - it's the first time the user gets this question correct

create or replace function public.award_quiz_question_xp(
  p_question_id uuid,
  p_selected_index integer
)
returns table (
  is_correct boolean,
  xp_awarded integer,
  xp_total integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_correct_index integer;
  v_set_id uuid;
  v_is_official boolean;
  v_published boolean;
  v_difficulty smallint;
  v_xp integer;
  v_new_total integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return;
  end if;

  -- Fetch question + set metadata
  select q.correct_index, q.set_id, s.is_official, s.official_published, s.difficulty
    into v_correct_index, v_set_id, v_is_official, v_published, v_difficulty
  from public.quiz_questions q
  join public.quiz_sets s on s.id = q.set_id
  where q.id = p_question_id;

  if v_set_id is null then
    return;
  end if;

  is_correct := (p_selected_index = v_correct_index);
  xp_awarded := 0;

  -- Only official + published sets grant XP
  if not (coalesce(v_is_official, false) and coalesce(v_published, false)) then
    select p.xp_total into xp_total from public.profiles p where p.id = v_user_id;
    return next;
    return;
  end if;

  if not is_correct then
    select p.xp_total into xp_total from public.profiles p where p.id = v_user_id;
    return next;
    return;
  end if;

  -- Prevent farming: only 1x XP per question (first correct)
  if exists (
    select 1 from public.quiz_question_progress qp
    where qp.user_id = v_user_id and qp.question_id = p_question_id
  ) then
    select p.xp_total into xp_total from public.profiles p where p.id = v_user_id;
    return next;
    return;
  end if;

  insert into public.quiz_question_progress (user_id, question_id)
  values (v_user_id, p_question_id)
  on conflict do nothing;

  -- Difficulty: 1..3 (default 1)
  v_difficulty := greatest(1, least(3, coalesce(v_difficulty, 1)));
  v_xp := case v_difficulty
    when 1 then 10
    when 2 then 15
    else 20
  end;

  insert into public.xp_events (user_id, xp, source, meta)
  values (
    v_user_id,
    v_xp,
    'quiz_question',
    jsonb_build_object('question_id', p_question_id, 'set_id', v_set_id, 'difficulty', v_difficulty)
  );

  update public.profiles
     set xp_total = xp_total + v_xp
   where id = v_user_id
   returning xp_total into v_new_total;

  is_correct := true;
  xp_awarded := v_xp;
  xp_total := coalesce(v_new_total, 0);
  return next;
end;
$$;

-- 7) Daily XP aggregation for chart (last N days)
create or replace function public.get_xp_daily(p_days integer default 90)
returns table (
  day date,
  xp integer
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      (current_date - greatest(1, least(365, coalesce(p_days, 90))) + 1)::date as d0,
      current_date::date as d1
  ),
  days as (
    select generate_series((select d0 from bounds), (select d1 from bounds), interval '1 day')::date as day
  ),
  agg as (
    select
      (e.occurred_at at time zone 'UTC')::date as day,
      sum(e.xp)::int as xp
    from public.xp_events e
    where e.user_id = auth.uid()
      and e.occurred_at >= (select d0 from bounds)
    group by 1
  )
  select d.day, coalesce(a.xp, 0) as xp
  from days d
  left join agg a using (day)
  order by d.day;
$$;

-- Public activity chart (per-user)
--
-- This enables showing the XP chart on other users' public profiles.
-- Access is limited to authenticated users.
create or replace function public.get_xp_daily_for_user(p_user_id uuid, p_days integer default 90)
returns table(day date, xp integer)
language sql
security definer
set search_path = public
as $$
  with bounds as (
    select (current_date - greatest(1, coalesce(p_days, 90)) + 1)::date as d0,
           current_date::date as d1
  ),
  days as (
    select generate_series((select d0 from bounds), (select d1 from bounds), interval '1 day')::date as day
  ),
  agg as (
    select (e.occurred_at at time zone 'UTC')::date as day,
           sum(e.xp)::int as xp
    from public.xp_events e
    where auth.uid() is not null
      and e.user_id = p_user_id
      and e.occurred_at >= (select d0 from bounds)
      and e.occurred_at < (select d1 from bounds) + interval '1 day'
    group by 1
  )
  select d.day,
         coalesce(a.xp, 0) as xp
  from days d
  left join agg a using (day)
  order by d.day;
$$;

-- NOTE:
-- To create official quizzes:
-- 1) Insert your user_id into public.app_admins.
-- 2) Set quiz_sets.is_official=true, official_published=true, and (recommended) visibility='public'.
