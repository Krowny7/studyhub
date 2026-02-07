-- CFA Hub — Duels (PvP) SQL Setup
-- Run this file in Supabase SQL editor.
-- It is written to be safe to run multiple times.

-- =========================
-- 0) Core tables (created if missing)
-- =========================

create table if not exists public.pvp_challenges (
  id uuid primary key default gen_random_uuid(),
  quiz_set_id uuid not null,
  created_by uuid not null,
  opponent_id uuid not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  rated boolean not null default false,
  winner_id uuid
);

create index if not exists pvp_challenges_created_by_idx on public.pvp_challenges(created_by);
create index if not exists pvp_challenges_opponent_id_idx on public.pvp_challenges(opponent_id);
create index if not exists pvp_challenges_quiz_set_id_idx on public.pvp_challenges(quiz_set_id);

create table if not exists public.pvp_attempts (
  challenge_id uuid not null references public.pvp_challenges(id) on delete cascade,
  user_id uuid not null,
  score integer not null,
  total integer not null,
  duration_seconds integer not null,
  submitted_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create index if not exists pvp_attempts_user_id_idx on public.pvp_attempts(user_id);
create index if not exists pvp_attempts_challenge_id_idx on public.pvp_attempts(challenge_id);

-- =========================
-- 1) Status constraint (keep it aligned with the app)
-- =========================
alter table if exists public.pvp_challenges
  drop constraint if exists pvp_challenges_status_check;

alter table if exists public.pvp_challenges
  add constraint pvp_challenges_status_check
  check (status in ('pending','accepted','completed','expired'));

-- =========================
-- 1) Ratings table (ELO)
-- =========================
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'ratings'
  ) then
    create table public.ratings (
      user_id uuid primary key references auth.users(id) on delete cascade,
      elo integer not null default 1200,
      games_played integer not null default 0,
      updated_at timestamptz not null default now()
    );
  end if;

  -- Ensure required columns exist (and rename common legacy names).
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'ratings'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='ratings' and column_name='elo'
    ) then
      if exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='ratings' and column_name='rating'
      ) then
        alter table public.ratings rename column rating to elo;
      elsif exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='ratings' and column_name='elo_rating'
      ) then
        alter table public.ratings rename column elo_rating to elo;
      else
        alter table public.ratings add column elo integer not null default 1200;
      end if;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='ratings' and column_name='games_played'
    ) then
      alter table public.ratings add column games_played integer not null default 0;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='ratings' and column_name='updated_at'
    ) then
      alter table public.ratings add column updated_at timestamptz not null default now();
    end if;
  end if;
end $$;

alter table public.ratings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='ratings' and policyname='ratings_read'
  ) then
    create policy ratings_read on public.ratings
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- =========================
-- 2) Rating events (audit log)
-- =========================
create table if not exists public.pvp_rating_events (
  id bigserial primary key,
  challenge_id uuid not null references public.pvp_challenges(id) on delete cascade,
  user_a uuid not null,
  user_b uuid not null,
  elo_a_before integer not null,
  elo_b_before integer not null,
  elo_a_after integer not null,
  elo_b_after integer not null,
  k_factor integer not null,
  created_at timestamptz not null default now()
);

alter table public.pvp_rating_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pvp_rating_events' and policyname='pvp_rating_events_read'
  ) then
    create policy pvp_rating_events_read on public.pvp_rating_events
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- =========================
-- 3) Helpers
-- =========================
create or replace function public.ensure_rating_row(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ratings (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
end;
$$;

-- =========================
-- 4) RPC: get challenge detail
-- IMPORTANT: Drop first (return types often change during dev)
-- =========================
drop function if exists public.pvp_get_challenge_detail(uuid,text);

create or replace function public.pvp_get_challenge_detail(
  p_challenge_id uuid,
  p_lang text default 'en'
)
returns table (
  id uuid,
  quiz_set_id uuid,
  status text,
  created_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  rated boolean,
  winner_id uuid,
  created_by uuid,
  opponent_id uuid,
  inviter_username text,
  inviter_avatar_url text,
  opponent_username text,
  opponent_avatar_url text,
  quiz_title text,
  question_count integer,
  attempt_a_user_id uuid,
  attempt_a_score integer,
  attempt_a_total integer,
  attempt_a_duration_seconds integer,
  attempt_a_submitted_at timestamptz,
  attempt_b_user_id uuid,
  attempt_b_score integer,
  attempt_b_total integer,
  attempt_b_duration_seconds integer,
  attempt_b_submitted_at timestamptz,
  inviter_elo integer,
  opponent_elo integer,
  rating_event jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter uuid;
  v_opponent uuid;
  v_a record;
  v_b record;
  v_qcount integer;
  v_qtitle text;
  v_event record;
  v_inviter_elo integer;
  v_opponent_elo integer;
begin
  select c.created_by, c.opponent_id
    into v_inviter, v_opponent
  from public.pvp_challenges c
  where c.id = p_challenge_id;

  if v_inviter is null then
    return;
  end if;

  perform public.ensure_rating_row(v_inviter);
  perform public.ensure_rating_row(v_opponent);

  select r.elo into v_inviter_elo from public.ratings r where r.user_id = v_inviter;
  select r.elo into v_opponent_elo from public.ratings r where r.user_id = v_opponent;

  select a.* into v_a
  from public.pvp_attempts a
  where a.challenge_id = p_challenge_id and a.user_id = v_inviter
  limit 1;

  select a.* into v_b
  from public.pvp_attempts a
  where a.challenge_id = p_challenge_id and a.user_id = v_opponent
  limit 1;

  select qs.title, coalesce(qs.question_count, 0)
    into v_qtitle, v_qcount
  from public.quiz_sets qs
  join public.pvp_challenges c on c.quiz_set_id = qs.id
  where c.id = p_challenge_id;

  -- Most recent rating event for this challenge
  select e.* into v_event
  from public.pvp_rating_events e
  where e.challenge_id = p_challenge_id
  order by e.created_at desc
  limit 1;

  return query
  select
    c.id,
    c.quiz_set_id,
    c.status,
    c.created_at,
    c.accepted_at,
    c.completed_at,
    c.expires_at,
    c.rated,
    c.winner_id,
    c.created_by,
    c.opponent_id,
    u1.username as inviter_username,
    u1.avatar_url as inviter_avatar_url,
    u2.username as opponent_username,
    u2.avatar_url as opponent_avatar_url,
    v_qtitle as quiz_title,
    v_qcount as question_count,
    v_a.user_id as attempt_a_user_id,
    v_a.score as attempt_a_score,
    v_a.total as attempt_a_total,
    v_a.duration_seconds as attempt_a_duration_seconds,
    v_a.submitted_at as attempt_a_submitted_at,
    v_b.user_id as attempt_b_user_id,
    v_b.score as attempt_b_score,
    v_b.total as attempt_b_total,
    v_b.duration_seconds as attempt_b_duration_seconds,
    v_b.submitted_at as attempt_b_submitted_at,
    v_inviter_elo as inviter_elo,
    v_opponent_elo as opponent_elo,
    case
      when v_event.id is null then null
      else jsonb_build_object(
        'id', v_event.id,
        'challenge_id', v_event.challenge_id,
        'user_a', v_event.user_a,
        'user_b', v_event.user_b,
        'elo_a_before', v_event.elo_a_before,
        'elo_b_before', v_event.elo_b_before,
        'elo_a_after', v_event.elo_a_after,
        'elo_b_after', v_event.elo_b_after,
        'k_factor', v_event.k_factor,
        'created_at', v_event.created_at
      )
    end as rating_event
  from public.pvp_challenges c
  left join public.profiles u1 on u1.id = c.created_by
  left join public.profiles u2 on u2.id = c.opponent_id
  where c.id = p_challenge_id;
end;
$$;

-- =========================
-- 5) RPC: submit attempt
-- =========================
drop function if exists public.pvp_submit_attempt(uuid,integer,integer,integer);

create or replace function public.pvp_submit_attempt(
  p_challenge_id uuid,
  p_score integer,
  p_total integer,
  p_duration_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ch record;
  v_existing record;
  v_other record;
  v_winner uuid;
  v_better boolean;
  v_need_rate boolean := false;
  v_min_questions integer := 5;
  v_k integer := 32;
  v_elo_a int;
  v_elo_b int;
  v_expected_a numeric;
  v_score_a numeric;
  v_new_a int;
  v_new_b int;
  v_user_a uuid;
  v_user_b uuid;
  v_a record;
  v_b record;
  v_event_id bigint;
begin
  select * into v_ch
  from public.pvp_challenges
  where id = p_challenge_id;

  if v_ch.id is null then
    return jsonb_build_object('ok', false, 'error', 'challenge_not_found');
  end if;

  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if v_uid <> v_ch.created_by and v_uid <> v_ch.opponent_id then
    return jsonb_build_object('ok', false, 'error', 'not_participant');
  end if;

  -- Insert or update attempt
  select * into v_existing
  from public.pvp_attempts
  where challenge_id = p_challenge_id and user_id = v_uid
  limit 1;

  if v_existing.challenge_id is null then
    insert into public.pvp_attempts (challenge_id, user_id, score, total, duration_seconds)
    values (p_challenge_id, v_uid, p_score, p_total, p_duration_seconds);
  else
    -- Keep best score; if same score, keep faster time.
    v_better := (p_score > v_existing.score)
      or (p_score = v_existing.score and p_duration_seconds < coalesce(v_existing.duration_seconds, 2147483647));

    if v_better then
      update public.pvp_attempts
        set score = p_score,
            total = p_total,
            duration_seconds = p_duration_seconds,
            submitted_at = now()
      where challenge_id = p_challenge_id and user_id = v_uid;
    end if;
  end if;

  -- Check if both attempts exist now
  select * into v_other
  from public.pvp_attempts
  where challenge_id = p_challenge_id and user_id <> v_uid
  limit 1;

  if v_other.challenge_id is not null then
    -- Determine winner (highest score, then fastest)
    select * into v_a
      from public.pvp_attempts
      where challenge_id = p_challenge_id and user_id = v_ch.created_by
      limit 1;

    select * into v_b
      from public.pvp_attempts
      where challenge_id = p_challenge_id and user_id = v_ch.opponent_id
      limit 1;

    if v_a.challenge_id is not null and v_b.challenge_id is not null then
      if v_a.score > v_b.score then
        v_winner := v_a.user_id;
      elsif v_b.score > v_a.score then
        v_winner := v_b.user_id;
      else
        -- tie: fastest wins
        if coalesce(v_a.duration_seconds, 2147483647) <= coalesce(v_b.duration_seconds, 2147483647) then
          v_winner := v_a.user_id;
        else
          v_winner := v_b.user_id;
        end if;
      end if;

      update public.pvp_challenges
        set status = 'completed',
            completed_at = now(),
            winner_id = v_winner
      where id = p_challenge_id;

      -- Rate only once and only if enough questions.
      if coalesce(v_ch.rated, false) = false and coalesce(v_a.total, 0) >= v_min_questions then
        v_need_rate := true;
      end if;

      if v_need_rate then
        v_user_a := v_ch.created_by;
        v_user_b := v_ch.opponent_id;

        perform public.ensure_rating_row(v_user_a);
        perform public.ensure_rating_row(v_user_b);

        select r.elo into v_elo_a from public.ratings r where r.user_id = v_user_a;
        select r.elo into v_elo_b from public.ratings r where r.user_id = v_user_b;

        -- Winner score for ELO (1 for win, 0 for loss). No draws because we break ties on time.
        if v_winner = v_user_a then
          v_score_a := 1;
        else
          v_score_a := 0;
        end if;

        v_expected_a := 1 / (1 + power(10, ((v_elo_b - v_elo_a)::numeric) / 400));
        v_new_a := round(v_elo_a + v_k * (v_score_a - v_expected_a));
        v_new_b := round(v_elo_b + v_k * ((1 - v_score_a) - (1 - v_expected_a)));

        update public.ratings
          set elo = v_new_a,
              games_played = games_played + 1,
              updated_at = now()
        where user_id = v_user_a;

        update public.ratings
          set elo = v_new_b,
              games_played = games_played + 1,
              updated_at = now()
        where user_id = v_user_b;

        insert into public.pvp_rating_events (
          challenge_id, user_a, user_b,
          elo_a_before, elo_b_before,
          elo_a_after, elo_b_after,
          k_factor
        ) values (
          p_challenge_id, v_user_a, v_user_b,
          v_elo_a, v_elo_b,
          v_new_a, v_new_b,
          v_k
        ) returning id into v_event_id;

        update public.pvp_challenges
          set rated = true
        where id = p_challenge_id;

        return jsonb_build_object(
          'ok', true,
          'completed', true,
          'rated', true,
          'winner_id', v_winner,
          'rating_event_id', v_event_id
        );
      end if;

      return jsonb_build_object(
        'ok', true,
        'completed', true,
        'rated', false,
        'winner_id', v_winner
      );
    end if;
  end if;

  return jsonb_build_object('ok', true, 'completed', false);
end;
$$;

-- =========================
-- 6) Ask PostgREST to refresh its schema cache (important after RPC changes)
-- =========================
notify pgrst, 'reload schema';
