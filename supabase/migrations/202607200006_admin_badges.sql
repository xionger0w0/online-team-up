-- 由数据库保存管理员身份，普通用户不能自行添加或修改。

create table if not exists public.site_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.site_admins enable row level security;
drop policy if exists "everyone can see admin badges" on public.site_admins;
create policy "everyone can see admin badges" on public.site_admins
for select to authenticated using (true);

revoke insert, update, delete on public.site_admins from anon, authenticated;
grant select on public.site_admins to authenticated;

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
  author_intro text,
  author_is_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.kind, p.body, p.team_id, p.created_at,
    u.id, u.nickname, u.avatar_url, u.building, u.gender, u.major,
    count(c.id), u.weekday_sleep, u.interests, u.intro,
    exists (select 1 from public.site_admins a where a.user_id = u.id)
  from public.lobby_posts p
  join public.profiles u on u.id = p.author_id
  left join public.lobby_comments c on c.post_id = p.id
  where auth.uid() is not null
  group by p.id, u.id
  order by p.created_at desc
  limit least(greatest(post_limit, 1), 100);
$$;

drop function if exists public.list_lobby_comments(uuid);
create function public.list_lobby_comments(target_post uuid)
returns table (
  id uuid,
  post_id uuid,
  body text,
  created_at timestamptz,
  author_id uuid,
  author_nickname text,
  author_avatar text,
  author_building text,
  author_gender text,
  author_major text,
  author_is_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.post_id, c.body, c.created_at,
    u.id, u.nickname, u.avatar_url, u.building, u.gender, u.major,
    exists (select 1 from public.site_admins a where a.user_id = u.id)
  from public.lobby_comments c
  join public.profiles u on u.id = c.author_id
  where c.post_id = target_post and auth.uid() is not null
  order by c.created_at asc
  limit 200;
$$;

drop function if exists public.list_lobby_contact_links();
create function public.list_lobby_contact_links()
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
  other_is_admin boolean,
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
    exists (select 1 from public.site_admins a where a.user_id = other_user.id),
    case when r.status = 'accepted' then cm.contact_type else null end,
    case when r.status = 'accepted' then cm.contact_value else null end
  from public.lobby_contact_requests r
  join public.profiles other_user on other_user.id = case
    when r.requester_id = auth.uid() then r.recipient_id else r.requester_id end
  left join public.contact_methods cm on cm.user_id = other_user.id
  where auth.uid() in (r.requester_id, r.recipient_id)
  order by r.created_at desc;
$$;

revoke all on function public.list_lobby_posts(int) from public;
revoke all on function public.list_lobby_comments(uuid) from public;
revoke all on function public.list_lobby_contact_links() from public;
grant execute on function public.list_lobby_posts(int) to authenticated;
grant execute on function public.list_lobby_comments(uuid) to authenticated;
grant execute on function public.list_lobby_contact_links() to authenticated;

-- 绑定管理员时请单独执行：
-- insert into public.site_admins (user_id) values ('你的账户 UUID');
