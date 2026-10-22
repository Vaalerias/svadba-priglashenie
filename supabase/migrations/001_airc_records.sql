-- AIRC Starter: универсальная таблица записей.
-- Учебная схема. Перед реальным запуском добавь серверный rate limit для публичных форм.

create extension if not exists pgcrypto;

create table if not exists public.airc_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null check (char_length(workspace_id) between 3 and 64),
  record_type text not null check (record_type in ('lead', 'quiz_result', 'client', 'task')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (char_length(status) between 2 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists airc_records_workspace_type_created_idx
  on public.airc_records (workspace_id, record_type, created_at desc);

create table if not exists public.airc_members (
  workspace_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.airc_records enable row level security;
alter table public.airc_members enable row level security;

create or replace function public.airc_is_member(target_workspace text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.airc_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
  );
$$;

revoke all on function public.airc_is_member(text) from public;
grant execute on function public.airc_is_member(text) to authenticated;

drop policy if exists "public can submit limited records" on public.airc_records;
create policy "public can submit limited records"
on public.airc_records
for insert
to anon, authenticated
with check (
  record_type in ('lead', 'quiz_result')
  and pg_column_size(payload) <= 20000
  and archived_at is null
);

drop policy if exists "members can read workspace records" on public.airc_records;
create policy "members can read workspace records"
on public.airc_records
for select
to authenticated
using (public.airc_is_member(workspace_id));

drop policy if exists "members can create workspace records" on public.airc_records;
create policy "members can create workspace records"
on public.airc_records
for insert
to authenticated
with check (public.airc_is_member(workspace_id));

drop policy if exists "members can update workspace records" on public.airc_records;
create policy "members can update workspace records"
on public.airc_records
for update
to authenticated
using (public.airc_is_member(workspace_id))
with check (public.airc_is_member(workspace_id));

drop policy if exists "members can read memberships" on public.airc_members;
create policy "members can read memberships"
on public.airc_members
for select
to authenticated
using (user_id = auth.uid());

grant insert on public.airc_records to anon;
grant select, insert, update on public.airc_records to authenticated;
grant select on public.airc_members to authenticated;

-- После создания пользователя добавь его в рабочее пространство:
-- insert into public.airc_members (workspace_id, user_id, role)
-- values ('airc-demo', 'UUID_ПОЛЬЗОВАТЕЛЯ', 'owner');
