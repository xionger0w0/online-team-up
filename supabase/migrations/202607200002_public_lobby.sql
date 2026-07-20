-- 线上组队：统一公共大厅、实时消息、招募信息与帖内留言。

drop policy if exists "profiles in same segment" on public.profiles;
create policy "visible profiles in public lobby" on public.profiles
for select to authenticated
using (id = auth.uid() or visible);

drop policy if exists "same segment teams" on public.teams;
create policy "all teams visible in public lobby" on public.teams
for select to authenticated
using (true);

create table public.lobby_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'chat' check (kind in ('chat', 'recruitment')),
  body text not null check (char_length(body) between 1 and 500),
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table public.lobby_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.lobby_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index lobby_posts_created_at_idx on public.lobby_posts (created_at desc);
create index lobby_posts_kind_created_at_idx on public.lobby_posts (kind, created_at desc);
create index lobby_comments_post_created_at_idx on public.lobby_comments (post_id, created_at);

alter table public.lobby_posts enable row level security;
alter table public.lobby_comments enable row level security;

create policy "authenticated users read lobby posts" on public.lobby_posts
for select to authenticated using (true);
create policy "authors delete own lobby posts" on public.lobby_posts
for delete to authenticated using (author_id = auth.uid());
create policy "authenticated users read lobby comments" on public.lobby_comments
for select to authenticated using (true);
create policy "authors delete own lobby comments" on public.lobby_comments
for delete to authenticated using (author_id = auth.uid());

create or replace function public.list_lobby_posts(post_limit int default 100)
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
  comment_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.kind, p.body, p.team_id, p.created_at,
    u.id, u.nickname, u.avatar_url, u.building, u.gender, u.major,
    count(c.id) as comment_count
  from public.lobby_posts p
  join public.profiles u on u.id = p.author_id
  left join public.lobby_comments c on c.post_id = p.id
  where auth.uid() is not null
  group by p.id, u.id
  order by p.created_at desc
  limit least(greatest(post_limit, 1), 100);
$$;

create or replace function public.list_lobby_comments(target_post uuid)
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
  author_major text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.post_id, c.body, c.created_at,
    u.id, u.nickname, u.avatar_url, u.building, u.gender, u.major
  from public.lobby_comments c
  join public.profiles u on u.id = c.author_id
  where c.post_id = target_post and auth.uid() is not null
  order by c.created_at asc
  limit 200;
$$;

create or replace function public.publish_lobby_post(
  post_kind text,
  message_body text,
  target_team uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_post_id uuid;
  me public.profiles%rowtype;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception '请先填写个人介绍'; end if;
  if not me.visible then raise exception '请先将介绍设为同学可见，再参与公共大厅'; end if;
  if post_kind not in ('chat', 'recruitment') then raise exception '消息类型不正确'; end if;
  if char_length(trim(message_body)) not between 1 and 500 then raise exception '内容请保持在 1 到 500 字之间'; end if;
  if exists (
    select 1 from public.lobby_posts
    where author_id = auth.uid() and created_at > now() - interval '8 seconds'
  ) then raise exception '可以稍等几秒再发送下一条消息'; end if;
  if target_team is not null and not exists (
    select 1 from public.teams where id = target_team and captain_id = auth.uid()
  ) then raise exception '只能关联自己创建的小队'; end if;
  insert into public.lobby_posts (author_id, kind, body, team_id)
  values (auth.uid(), post_kind, trim(message_body), target_team)
  returning id into new_post_id;
  return new_post_id;
end;
$$;

create or replace function public.add_lobby_comment(target_post uuid, message_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_comment_id uuid;
  me public.profiles%rowtype;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception '请先填写个人介绍'; end if;
  if not exists (select 1 from public.lobby_posts where id = target_post) then raise exception '这条信息已经不存在'; end if;
  if char_length(trim(message_body)) not between 1 and 300 then raise exception '留言请保持在 1 到 300 字之间'; end if;
  if exists (
    select 1 from public.lobby_comments
    where author_id = auth.uid() and created_at > now() - interval '5 seconds'
  ) then raise exception '可以稍等几秒再发送下一条留言'; end if;
  insert into public.lobby_comments (post_id, author_id, body)
  values (target_post, auth.uid(), trim(message_body))
  returning id into new_comment_id;
  return new_comment_id;
end;
$$;

create or replace function public.report_lobby_post(target_post uuid, report_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  report_id uuid;
  target_author uuid;
begin
  select author_id into target_author from public.lobby_posts where id = target_post;
  if target_author is null then raise exception '这条信息已经不存在'; end if;
  insert into public.reports (reporter_id, target_user_id, reason, details)
  values (auth.uid(), target_author, '公共大厅内容', left(trim(report_reason), 500))
  returning id into report_id;
  return report_id;
end;
$$;

revoke all on function public.list_lobby_posts(int) from public;
revoke all on function public.list_lobby_comments(uuid) from public;
revoke all on function public.publish_lobby_post(text, text, uuid) from public;
revoke all on function public.add_lobby_comment(uuid, text) from public;
revoke all on function public.report_lobby_post(uuid, text) from public;
grant execute on function public.list_lobby_posts(int) to authenticated;
grant execute on function public.list_lobby_comments(uuid) to authenticated;
grant execute on function public.publish_lobby_post(text, text, uuid) to authenticated;
grant execute on function public.add_lobby_comment(uuid, text) to authenticated;
grant execute on function public.report_lobby_post(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lobby_posts'
  ) then alter publication supabase_realtime add table public.lobby_posts; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lobby_comments'
  ) then alter publication supabase_realtime add table public.lobby_comments; end if;
end;
$$;

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
  where auth.uid() is not null
  group by t.id
  order by t.created_at desc;
$$;
