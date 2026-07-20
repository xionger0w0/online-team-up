-- 线上组队：修复递归 RLS，并加入组队事务接口。

create or replace function public.is_same_segment(target_gender text, target_building text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.gender = target_gender
      and me.building = target_building
  );
$$;

create or replace function public.shares_team(target_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = target_team and tm.user_id = auth.uid()
  );
$$;

create or replace function public.is_team_captain(target_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teams t
    where t.id = target_team and t.captain_id = auth.uid()
  );
$$;

revoke all on function public.is_same_segment(text, text) from public;
revoke all on function public.shares_team(uuid) from public;
revoke all on function public.is_team_captain(uuid) from public;
grant execute on function public.is_same_segment(text, text) to authenticated;
grant execute on function public.shares_team(uuid) to authenticated;
grant execute on function public.is_team_captain(uuid) to authenticated;

drop policy if exists "profiles in same segment" on public.profiles;
create policy "profiles in same segment" on public.profiles
for select to authenticated
using (id = auth.uid() or (visible and public.is_same_segment(gender, building)));

drop policy if exists "same segment teams" on public.teams;
create policy "same segment teams" on public.teams
for select to authenticated
using (public.is_same_segment(gender, building));

drop policy if exists "team members can read roster" on public.team_members;
create policy "team members can read roster" on public.team_members
for select to authenticated
using (public.shares_team(team_id));

drop policy if exists "applications participants" on public.team_applications;
drop policy if exists "participants update application" on public.team_applications;
create policy "applications participants" on public.team_applications
for select to authenticated
using (applicant_id = auth.uid() or public.is_team_captain(team_id));

create or replace function public.list_visible_teams()
returns table (
  id uuid,
  name text,
  building text,
  gender text,
  capacity int,
  member_count bigint,
  summary text,
  orientation text,
  open boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id, t.name, t.building, t.gender, t.capacity,
    count(tm.user_id) as member_count,
    t.summary, t.orientation, t.open, t.created_at
  from public.teams t
  left join public.team_members tm on tm.team_id = t.id
  where public.is_same_segment(t.gender, t.building)
  group by t.id
  order by t.created_at desc;
$$;

create or replace function public.create_team(
  team_name text,
  team_summary text,
  team_orientation text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
  new_team_id uuid;
  room_capacity int;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception '请先完善个人资料'; end if;
  if exists (select 1 from public.team_members where user_id = auth.uid()) then
    raise exception '每人同一时间只能加入一个队伍';
  end if;
  room_capacity := case when me.building = '23' then 8 else 4 end;
  insert into public.teams (captain_id, name, building, gender, capacity, summary, orientation)
  values (auth.uid(), team_name, me.building, me.gender, room_capacity, team_summary, team_orientation)
  returning id into new_team_id;
  insert into public.team_members (team_id, user_id, role)
  values (new_team_id, auth.uid(), 'captain');
  return new_team_id;
end;
$$;

create or replace function public.apply_to_team(target_team uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
  target public.teams%rowtype;
  application_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into target from public.teams where id = target_team;
  if me.id is null or target.id is null then raise exception '资料或队伍不存在'; end if;
  if me.gender <> target.gender or me.building <> target.building then raise exception '只能申请同楼同性别队伍'; end if;
  if not target.open then raise exception '该队伍已停止招募'; end if;
  if exists (select 1 from public.team_members where user_id = auth.uid()) then raise exception '你已经加入队伍'; end if;
  insert into public.team_applications (team_id, applicant_id, status)
  values (target_team, auth.uid(), 'pending')
  on conflict (team_id, applicant_id) do update
    set status = 'pending', captain_reason = null, created_at = now()
  returning id into application_id;
  insert into public.notifications (user_id, type, title, body)
  values (target.captain_id, 'team_application', '收到新的入队申请', me.nickname || '申请加入「' || target.name || '」');
  return application_id;
end;
$$;

create or replace function public.review_team_application(
  application_id uuid,
  approve boolean,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  application public.team_applications%rowtype;
  team_name text;
begin
  select a.* into application
  from public.team_applications a
  join public.teams t on t.id = a.team_id
  where a.id = application_id and t.captain_id = auth.uid();
  if application.id is null then raise exception '无权处理该申请'; end if;
  select name into team_name from public.teams where id = application.team_id;
  update public.team_applications
  set status = case when approve then 'captain_approved' else 'rejected' end,
      captain_reason = reason
  where id = application_id;
  insert into public.notifications (user_id, type, title, body)
  values (
    application.applicant_id,
    'team_application_reviewed',
    case when approve then '队长已同意你的申请' else '入队申请未通过' end,
    case when approve then '请再次确认是否加入「' || team_name || '」' else coalesce(reason, '可以继续寻找其他队伍') end
  );
end;
$$;

create or replace function public.confirm_team_application(application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  application public.team_applications%rowtype;
  target public.teams%rowtype;
  current_members int;
begin
  select * into application from public.team_applications
  where id = application_id and applicant_id = auth.uid() and status = 'captain_approved'
  for update;
  if application.id is null then raise exception '申请不存在或尚未获得队长同意'; end if;
  if exists (select 1 from public.team_members where user_id = auth.uid()) then raise exception '你已经加入其他队伍'; end if;
  select * into target from public.teams where id = application.team_id for update;
  select count(*) into current_members from public.team_members where team_id = target.id;
  if current_members >= target.capacity then raise exception '队伍人数已满'; end if;
  insert into public.team_members (team_id, user_id, role) values (target.id, auth.uid(), 'member');
  update public.team_applications set status = 'accepted' where id = application_id;
  update public.team_applications set status = 'withdrawn'
  where applicant_id = auth.uid() and id <> application_id and status in ('pending', 'captain_approved');
  return target.id;
end;
$$;

create or replace function public.remove_team_member(target_user uuid, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_team uuid;
begin
  select tm.team_id into target_team
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  where tm.user_id = target_user and t.captain_id = auth.uid() and target_user <> auth.uid();
  if target_team is null then raise exception '无权移除该成员'; end if;
  delete from public.team_members where team_id = target_team and user_id = target_user;
  insert into public.notifications (user_id, type, title, body)
  values (target_user, 'removed_from_team', '你已被移出队伍', reason);
end;
$$;

revoke all on function public.list_visible_teams() from public;
revoke all on function public.create_team(text, text, text) from public;
revoke all on function public.apply_to_team(uuid) from public;
revoke all on function public.review_team_application(uuid, boolean, text) from public;
revoke all on function public.confirm_team_application(uuid) from public;
revoke all on function public.remove_team_member(uuid, text) from public;
grant execute on function public.list_visible_teams() to authenticated;
grant execute on function public.create_team(text, text, text) to authenticated;
grant execute on function public.apply_to_team(uuid) to authenticated;
grant execute on function public.review_team_application(uuid, boolean, text) to authenticated;
grant execute on function public.confirm_team_application(uuid) to authenticated;
grant execute on function public.remove_team_member(uuid, text) to authenticated;
