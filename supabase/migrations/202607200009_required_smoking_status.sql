-- 增加公开且必填的吸烟情况；旧账户下次进入时必须选择后才能继续。

alter table public.profiles
  add column if not exists smoking text not null default '未选择';

alter table public.profiles
  drop constraint if exists profiles_smoking_check;

alter table public.profiles
  add constraint profiles_smoking_check
  check (smoking in ('未选择', '不吸烟', '吸烟'));

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
  author_smoking text,
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
    count(c.id), u.weekday_sleep, u.smoking, u.interests, u.intro,
    exists (select 1 from public.site_admins a where a.user_id = u.id)
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
