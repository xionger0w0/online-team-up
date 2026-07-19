-- 线上组队：Supabase 初始数据库
-- 在 Supabase SQL Editor 中执行，或使用 `supabase db push`。

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 24),
  avatar_url text,
  gender text not null check (gender in ('female', 'male')),
  building text not null check (building in ('13','14','15','19','23')),
  major text not null,
  weekday_sleep text not null,
  weekend_sleep text not null,
  weekday_wake text not null,
  weekend_wake text not null,
  orientation text not null default '都可以' check (orientation in ('阳面','阴面','都可以')),
  interests text[] not null default '{}',
  intro text not null default '' check (char_length(intro) <= 200),
  verified boolean not null default false,
  visible boolean not null default true,
  open_to_contact boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint building_gender check (
    (building in ('13','14') and gender = 'female') or
    (building in ('15','19') and gender = 'male') or
    building = '23'
  ),
  constraint max_interests check (cardinality(interests) <= 8)
);

create table public.contact_methods (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  contact_type text not null check (contact_type in ('微信','QQ')),
  contact_value text not null check (char_length(contact_value) between 1 and 64),
  updated_at timestamptz not null default now()
);

create table public.reactions (
  actor_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (actor_id, target_id),
  check (actor_id <> target_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  captain_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 32),
  building text not null check (building in ('13','14','15','19','23')),
  gender text not null check (gender in ('female','male')),
  capacity int not null check (capacity in (4,8)),
  summary text not null default '' check (char_length(summary) <= 240),
  orientation text not null default '都可以',
  open boolean not null default true,
  created_at timestamptz not null default now(),
  constraint building_capacity check ((building = '23' and capacity = 8) or (building <> '23' and capacity = 4))
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('captain','member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table public.team_applications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','captain_approved','accepted','rejected','withdrawn')),
  captain_reason text,
  created_at timestamptz not null default now(),
  unique (team_id, applicant_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'pending' check (status in ('pending','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value) values
  ('dorm_selection_date', '"2026-08-01"'::jsonb),
  ('school_email_required', 'false'::jsonb)
on conflict (key) do nothing;

create or replace function public.can_view_contact(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = owner
  or exists (
    select 1 from reactions mine
    join reactions theirs on theirs.actor_id = mine.target_id and theirs.target_id = mine.actor_id
    where mine.actor_id = auth.uid() and mine.target_id = owner
  )
  or exists (
    select 1 from team_members me
    join team_members them on them.team_id = me.team_id
    where me.user_id = auth.uid() and them.user_id = owner
  );
$$;

alter table profiles enable row level security;
alter table contact_methods enable row level security;
alter table reactions enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_applications enable row level security;
alter table notifications enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;

create policy "profiles in same segment" on profiles for select to authenticated using (
  id = auth.uid() or (visible and exists (
    select 1 from profiles me where me.id = auth.uid() and me.gender = profiles.gender and me.building = profiles.building
  ))
);
create policy "own profile insert" on profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own profile delete" on profiles for delete to authenticated using (id = auth.uid());

create policy "permitted contacts" on contact_methods for select to authenticated using (can_view_contact(user_id));
create policy "own contacts write" on contact_methods for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own reactions" on reactions for select to authenticated using (actor_id = auth.uid() or target_id = auth.uid());
create policy "own reactions insert" on reactions for insert to authenticated with check (actor_id = auth.uid());
create policy "own reactions delete" on reactions for delete to authenticated using (actor_id = auth.uid());
create policy "same segment teams" on teams for select to authenticated using (exists (select 1 from profiles me where me.id = auth.uid() and me.gender = teams.gender and me.building = teams.building));
create policy "captain teams write" on teams for all to authenticated using (captain_id = auth.uid()) with check (captain_id = auth.uid());
create policy "team members can read roster" on team_members for select to authenticated using (exists (select 1 from team_members mine where mine.team_id = team_members.team_id and mine.user_id = auth.uid()));
create policy "applications participants" on team_applications for select to authenticated using (applicant_id = auth.uid() or exists (select 1 from teams t where t.id = team_id and t.captain_id = auth.uid()));
create policy "applicant creates application" on team_applications for insert to authenticated with check (applicant_id = auth.uid());
create policy "participants update application" on team_applications for update to authenticated using (applicant_id = auth.uid() or exists (select 1 from teams t where t.id = team_id and t.captain_id = auth.uid()));
create policy "own notifications" on notifications for select to authenticated using (user_id = auth.uid());
create policy "own blocks" on blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "own reports" on reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "read own reports" on reports for select to authenticated using (reporter_id = auth.uid());

-- 由 Supabase 定时任务每日调用；选寝日期后 30 天清理本届账号及关联数据。
create or replace function public.cleanup_expired_cohort()
returns bigint language plpgsql security definer set search_path = public as $$
declare deleted_count bigint;
declare selection_date date;
begin
  select (value #>> '{}')::date into selection_date from site_settings where key = 'dorm_selection_date';
  if current_date < selection_date + 30 then return 0; end if;
  delete from auth.users where id in (select id from profiles);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

