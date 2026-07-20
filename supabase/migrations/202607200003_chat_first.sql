-- 线上组队：以公共聊天为首页，移除未确定楼栋信息，并加入双向联系确认。

alter table public.profiles drop constraint if exists profiles_building_check;
alter table public.profiles drop constraint if exists building_gender;
alter table public.profiles
  add constraint profiles_building_check
  check (building in ('undecided','13','14','15','19','23'));
alter table public.profiles
  add constraint building_gender
  check (
    building = 'undecided' or
    (building in ('13','14') and gender = 'female') or
    (building in ('15','19') and gender = 'male') or
    building = '23'
  );

-- 去年的楼栋信息不再作为本届资料的一部分。
update public.profiles set building = 'undecided', updated_at = now();

drop function if exists public.list_lobby_posts(int);
create function public.list_lobby_posts(post_limit int default 100)
returns table (
  id uuid,
  kind text,
  body text,
  team_id uuid,
  created_at timestamptz,
  author_id uuid,
  author_nickname text,
  author_avatar text,
  author_building text,
  author_gender text,
  author_major text,
  comment_count bigint,
  author_sleep text,
  author_interests text[],
  author_intro text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.kind, p.body, p.team_id, p.created_at,
    u.id, u.nickname, u.avatar_url, u.building, u.gender, u.major,
    count(c.id), u.weekday_sleep, u.interests, u.intro
  from public.lobby_posts p
  join public.profiles u on u.id = p.author_id
  left join public.lobby_comments c on c.post_id = p.id
  where auth.uid() is not null
  group by p.id, u.id
  order by p.created_at desc
  limit least(greatest(post_limit, 1), 100);
$$;
revoke all on function public.list_lobby_posts(int) from public;
grant execute on function public.list_lobby_posts(int) to authenticated;

create table public.lobby_contact_requests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.lobby_posts(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (post_id, requester_id),
  check (requester_id <> recipient_id)
);

create index lobby_contact_requests_recipient_idx
  on public.lobby_contact_requests (recipient_id, status, created_at desc);

alter table public.lobby_contact_requests enable row level security;
create policy "contact request participants read" on public.lobby_contact_requests
for select to authenticated
using (requester_id = auth.uid() or recipient_id = auth.uid());

create or replace function public.request_lobby_contact(target_post uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.lobby_posts%rowtype;
  requester public.profiles%rowtype;
  recipient public.profiles%rowtype;
  request_id uuid;
begin
  select * into target from public.lobby_posts where id = target_post;
  select * into requester from public.profiles where id = auth.uid();
  select * into recipient from public.profiles where id = target.author_id;
  if target.id is null or target.kind <> 'recruitment' then raise exception '这条信息不是招募信息'; end if;
  if requester.id is null or recipient.id is null then raise exception '请先填写简单资料'; end if;
  if requester.id = recipient.id then raise exception '不能向自己发送联系意愿'; end if;
  if requester.gender <> recipient.gender then raise exception '舍友招募仅支持同性同学联系'; end if;
  insert into public.lobby_contact_requests (post_id, requester_id, recipient_id, status)
  values (target.id, requester.id, recipient.id, 'pending')
  on conflict (post_id, requester_id) do update
    set status = case when public.lobby_contact_requests.status = 'accepted' then 'accepted' else 'pending' end,
        created_at = case when public.lobby_contact_requests.status = 'accepted' then public.lobby_contact_requests.created_at else now() end,
        responded_at = case when public.lobby_contact_requests.status = 'accepted' then public.lobby_contact_requests.responded_at else null end
  returning id into request_id;
  insert into public.notifications (user_id, type, title, body)
  values (recipient.id, 'lobby_contact_request', '有人想进一步联系', requester.nickname || '对你的招募信息表示感兴趣');
  return request_id;
end;
$$;

create or replace function public.respond_lobby_contact(target_request uuid, accept_request boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request public.lobby_contact_requests%rowtype;
  recipient_name text;
begin
  select * into request from public.lobby_contact_requests
  where id = target_request and recipient_id = auth.uid()
  for update;
  if request.id is null then raise exception '这条联系意愿不存在或无权处理'; end if;
  update public.lobby_contact_requests
  set status = case when accept_request then 'accepted' else 'declined' end,
      responded_at = now()
  where id = request.id;
  select nickname into recipient_name from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, type, title, body)
  values (
    request.requester_id,
    'lobby_contact_response',
    case when accept_request then '可以进一步联系了' else '这次没有继续交换联系方式' end,
    case when accept_request then recipient_name || '同意与你交换联系方式' else '尊重彼此的选择，也可以继续在大厅慢慢看看' end
  );
end;
$$;

create or replace function public.list_lobby_contact_links()
returns table (
  request_id uuid,
  post_id uuid,
  relation_role text,
  request_status text,
  created_at timestamptz,
  other_id uuid,
  other_nickname text,
  other_avatar text,
  other_gender text,
  other_contact_type text,
  other_contact_value text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.post_id,
    case when r.requester_id = auth.uid() then 'requester' else 'recipient' end,
    r.status,
    r.created_at,
    other_user.id,
    other_user.nickname,
    other_user.avatar_url,
    other_user.gender,
    case when r.status = 'accepted' then cm.contact_type else null end,
    case when r.status = 'accepted' then cm.contact_value else null end
  from public.lobby_contact_requests r
  join public.profiles other_user on other_user.id = case
    when r.requester_id = auth.uid() then r.recipient_id else r.requester_id end
  left join public.contact_methods cm on cm.user_id = other_user.id
  where auth.uid() in (r.requester_id, r.recipient_id)
  order by r.created_at desc;
$$;

revoke all on function public.request_lobby_contact(uuid) from public;
revoke all on function public.respond_lobby_contact(uuid, boolean) from public;
revoke all on function public.list_lobby_contact_links() from public;
grant execute on function public.request_lobby_contact(uuid) to authenticated;
grant execute on function public.respond_lobby_contact(uuid, boolean) to authenticated;
grant execute on function public.list_lobby_contact_links() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lobby_contact_requests'
  ) then
    alter publication supabase_realtime add table public.lobby_contact_requests;
  end if;
end;
$$;
