-- CFA Hub — Exercise Sets (minimal, aligned with flashcards/QCM UX)
-- Apply in Supabase SQL editor.

-- 1) Main table
create table if not exists public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  visibility text not null default 'private', -- private | public | groups
  folder_id uuid references public.library_folders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exercise_sets_owner_created_idx on public.exercise_sets(owner_id, created_at desc);
create index if not exists exercise_sets_folder_idx on public.exercise_sets(folder_id);

alter table public.exercise_sets enable row level security;

-- 2) Share table (many groups per set)
create table if not exists public.exercise_set_shares (
  set_id uuid not null references public.exercise_sets(id) on delete cascade,
  group_id uuid not null references public.study_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (set_id, group_id)
);

create index if not exists exercise_set_shares_group_idx on public.exercise_set_shares(group_id);

alter table public.exercise_set_shares enable row level security;

-- 3) RLS policies (mirrors quiz_set_shares pattern)

-- exercise_sets: select
do $$ begin
  create policy "exercise_sets_select_visible"
  on public.exercise_sets
  for select
  to authenticated
  using (
    owner_id = auth.uid()
    or visibility = 'public'
    or (
      visibility in ('groups','group')
      and exists (
        select 1
        from public.exercise_set_shares s
        join public.group_memberships gm on gm.group_id = s.group_id
        where s.set_id = exercise_sets.id
          and gm.user_id = auth.uid()
      )
    )
  );
exception when duplicate_object then null; end $$;

-- exercise_sets: insert/update/delete owner-only
do $$ begin
  create policy "exercise_sets_insert_own"
  on public.exercise_sets
  for insert
  to authenticated
  with check (owner_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "exercise_sets_update_own"
  on public.exercise_sets
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "exercise_sets_delete_own"
  on public.exercise_sets
  for delete
  to authenticated
  using (owner_id = auth.uid());
exception when duplicate_object then null; end $$;

-- exercise_set_shares: select (owner OR member of that group)
do $$ begin
  create policy "exercise_set_shares_select_owner_or_member"
  on public.exercise_set_shares
  for select
  to authenticated
  using (
    exists (
      select 1 from public.exercise_sets es
      where es.id = exercise_set_shares.set_id
        and es.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.group_memberships gm
      where gm.group_id = exercise_set_shares.group_id
        and gm.user_id = auth.uid()
    )
  );
exception when duplicate_object then null; end $$;

-- exercise_set_shares: insert/delete owner-only
do $$ begin
  create policy "exercise_set_shares_insert_owner"
  on public.exercise_set_shares
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.exercise_sets es
      where es.id = exercise_set_shares.set_id
        and es.owner_id = auth.uid()
    )
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "exercise_set_shares_delete_owner"
  on public.exercise_set_shares
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.exercise_sets es
      where es.id = exercise_set_shares.set_id
        and es.owner_id = auth.uid()
    )
  );
exception when duplicate_object then null; end $$;

-- 4) Keep updated_at fresh
drop trigger if exists trg_touch_exercise_sets on public.exercise_sets;
create trigger trg_touch_exercise_sets
before update on public.exercise_sets
for each row execute function public.touch_updated_at();
