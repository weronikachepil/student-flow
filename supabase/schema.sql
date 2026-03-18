create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'student' check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

create table if not exists public.group_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  deadline date not null,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'todo' check (status in ('todo', 'inprogress', 'done')),
  details text not null default '',
  is_for_all boolean not null default true,
  assignee_id uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.personal_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  deadline date not null,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'todo' check (status in ('todo', 'inprogress', 'done')),
  details text not null default '',
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'other' check (type in ('drive', 'zoom', 'moodle', 'telegram', 'notes', 'other')),
  url text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  day_of_week text not null check (day_of_week in ('Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П''ятниця', 'Субота')),
  time_start time not null,
  subject text not null,
  room text not null default '',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_count integer;
begin
  select count(*) into profile_count from public.profiles;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when profile_count = 0 then 'admin' else 'student' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin(check_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.group_tasks enable row level security;
alter table public.personal_tasks enable row level security;
alter table public.announcements enable row level security;
alter table public.resources enable row level security;
alter table public.schedule_entries enable row level security;

drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "group_tasks_read_visible" on public.group_tasks;
create policy "group_tasks_read_visible"
on public.group_tasks
for select
to authenticated
using (
  is_for_all
  or assignee_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists "group_tasks_insert_admin" on public.group_tasks;
create policy "group_tasks_insert_admin"
on public.group_tasks
for insert
to authenticated
with check (public.is_admin(auth.uid()) and created_by = auth.uid());

drop policy if exists "group_tasks_update_visible_or_admin" on public.group_tasks;
create policy "group_tasks_update_visible_or_admin"
on public.group_tasks
for update
to authenticated
using (
  public.is_admin(auth.uid())
  or is_for_all
  or assignee_id = auth.uid()
)
with check (
  public.is_admin(auth.uid())
  or is_for_all
  or assignee_id = auth.uid()
);

drop policy if exists "group_tasks_delete_admin" on public.group_tasks;
create policy "group_tasks_delete_admin"
on public.group_tasks
for delete
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "personal_tasks_read_own" on public.personal_tasks;
create policy "personal_tasks_read_own"
on public.personal_tasks
for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "personal_tasks_insert_own" on public.personal_tasks;
create policy "personal_tasks_insert_own"
on public.personal_tasks
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "personal_tasks_update_own" on public.personal_tasks;
create policy "personal_tasks_update_own"
on public.personal_tasks
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "personal_tasks_delete_own" on public.personal_tasks;
create policy "personal_tasks_delete_own"
on public.personal_tasks
for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists "announcements_read_all" on public.announcements;
create policy "announcements_read_all"
on public.announcements
for select
to authenticated
using (true);

drop policy if exists "announcements_insert_admin" on public.announcements;
create policy "announcements_insert_admin"
on public.announcements
for insert
to authenticated
with check (public.is_admin(auth.uid()) and created_by = auth.uid());

drop policy if exists "resources_read_all" on public.resources;
create policy "resources_read_all"
on public.resources
for select
to authenticated
using (true);

drop policy if exists "resources_insert_admin" on public.resources;
create policy "resources_insert_admin"
on public.resources
for insert
to authenticated
with check (public.is_admin(auth.uid()) and created_by = auth.uid());

drop policy if exists "schedule_read_all" on public.schedule_entries;
create policy "schedule_read_all"
on public.schedule_entries
for select
to authenticated
using (true);

drop policy if exists "schedule_insert_admin" on public.schedule_entries;
create policy "schedule_insert_admin"
on public.schedule_entries
for insert
to authenticated
with check (public.is_admin(auth.uid()) and created_by = auth.uid());
