-- 受保护的真实姓名、站内私信与实时信箱。

create table if not exists public.profile_private_details (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  real_name text not null check (char_length(trim(real_name)) between 1 and 32),
  updated_at timestamptz not null default now()
);

alter table public.profile_private_details enable row level security;
drop policy if exists "own private profile details" on public.profile_private_details;
create policy "own private profile details" on public.profile_private_details
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_one uuid not null references public.profiles(id) on delete cascade,
  user_two uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (user_one, user_two),
  check (user_one < user_two)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists direct_conversations_last_message_idx
  on public.direct_conversations (last_message_at desc);
create index if not exists direct_messages_conversation_idx
  on public.direct_messages (conversation_id, created_at);
create index if not exists direct_messages_unread_idx
  on public.direct_messages (conversation_id, read_at, created_at);

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "conversation participants read" on public.direct_conversations;
create policy "conversation participants read" on public.direct_conversations
for select to authenticated
using (auth.uid() in (user_one, user_two));

drop policy if exists "conversation participants read messages" on public.direct_messages;
create policy "conversation participants read messages" on public.direct_messages
for select to authenticated
using (exists (
  select 1 from public.direct_conversations c
  where c.id = direct_messages.conversation_id
    and auth.uid() in (c.user_one, c.user_two)
));

create or replace function public.open_direct_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_id uuid;
begin
  if auth.uid() is null then raise exception '请先进入网站'; end if;
  if other_user = auth.uid() then raise exception '不能给自己发私信'; end if;
  if not exists (select 1 from public.profiles where id = other_user and visible) then
    raise exception '这位同学的主页暂时不可用';
  end if;

  insert into public.direct_conversations (user_one, user_two)
  values (least(auth.uid(), other_user), greatest(auth.uid(), other_user))
  on conflict (user_one, user_two) do update set user_one = excluded.user_one
  returning id into conversation_id;
  return conversation_id;
end;
$$;

create or replace function public.send_direct_message(target_conversation uuid, message_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_message_id uuid;
  recipient_id uuid;
  sender_nickname text;
begin
  select case when c.user_one = auth.uid() then c.user_two else c.user_one end
  into recipient_id
  from public.direct_conversations c
  where c.id = target_conversation and auth.uid() in (c.user_one, c.user_two);

  if recipient_id is null then raise exception '你无法进入这段私聊'; end if;
  if char_length(trim(message_body)) not between 1 and 500 then raise exception '私信请保持在 1 到 500 字之间'; end if;
  if exists (
    select 1 from public.direct_messages
    where sender_id = auth.uid() and created_at > now() - interval '3 seconds'
  ) then raise exception '可以稍等几秒再发送下一条私信'; end if;

  insert into public.direct_messages (conversation_id, sender_id, body)
  values (target_conversation, auth.uid(), trim(message_body))
  returning id into new_message_id;

  update public.direct_conversations
  set last_message_at = now()
  where id = target_conversation;

  select nickname into sender_nickname from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, type, title, body)
  values (recipient_id, 'direct_message', '收到一条新私信', sender_nickname || '给你发来一条私信');
  return new_message_id;
end;
$$;

create or replace function public.mark_direct_messages_read(target_conversation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.direct_conversations c
    where c.id = target_conversation and auth.uid() in (c.user_one, c.user_two)
  ) then raise exception '你无法进入这段私聊'; end if;

  update public.direct_messages
  set read_at = coalesce(read_at, now())
  where conversation_id = target_conversation
    and sender_id <> auth.uid()
    and read_at is null;
end;
$$;

create or replace function public.list_direct_conversations()
returns table (
  conversation_id uuid,
  other_id uuid,
  other_nickname text,
  other_avatar text,
  other_gender text,
  other_major text,
  other_is_admin boolean,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    other_user.id,
    other_user.nickname,
    other_user.avatar_url,
    other_user.gender,
    other_user.major,
    exists (select 1 from public.site_admins a where a.user_id = other_user.id),
    last_message.body,
    coalesce(last_message.created_at, c.last_message_at),
    (select count(*) from public.direct_messages unread
      where unread.conversation_id = c.id
        and unread.sender_id <> auth.uid()
        and unread.read_at is null)
  from public.direct_conversations c
  join public.profiles other_user on other_user.id = case
    when c.user_one = auth.uid() then c.user_two else c.user_one end
  left join lateral (
    select m.body, m.created_at
    from public.direct_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) last_message on true
  where auth.uid() in (c.user_one, c.user_two)
  order by coalesce(last_message.created_at, c.last_message_at) desc;
$$;

create or replace function public.list_direct_messages(target_conversation uuid)
returns table (
  message_id uuid,
  conversation_id uuid,
  message_body text,
  created_at timestamptz,
  sender_id uuid,
  sender_nickname text,
  sender_avatar text,
  sender_is_admin boolean,
  sender_is_mine boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.conversation_id,
    m.body,
    m.created_at,
    sender.id,
    sender.nickname,
    sender.avatar_url,
    exists (select 1 from public.site_admins a where a.user_id = sender.id),
    sender.id = auth.uid()
  from public.direct_messages m
  join public.direct_conversations c on c.id = m.conversation_id
  join public.profiles sender on sender.id = m.sender_id
  where m.conversation_id = target_conversation
    and auth.uid() in (c.user_one, c.user_two)
  order by m.created_at asc
  limit 500;
$$;

-- 联系意愿允许不同性别同学互相表达；组队选寝仍由组队流程单独限制为同性。
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
  if target.id is null then raise exception '这条信息已经不存在'; end if;

  select * into requester from public.profiles where id = auth.uid();
  select * into recipient from public.profiles where id = target.author_id;
  if requester.id is null or recipient.id is null then raise exception '请先填写个人简介'; end if;
  if requester.id = recipient.id then raise exception '不能向自己发送联系意愿'; end if;

  insert into public.lobby_contact_requests (post_id, requester_id, recipient_id, status)
  values (target.id, requester.id, recipient.id, 'pending')
  on conflict (post_id, requester_id) do update
    set status = case when public.lobby_contact_requests.status = 'accepted' then 'accepted' else 'pending' end,
        created_at = case when public.lobby_contact_requests.status = 'accepted' then public.lobby_contact_requests.created_at else now() end,
        responded_at = case when public.lobby_contact_requests.status = 'accepted' then public.lobby_contact_requests.responded_at else null end
  returning id into request_id;

  insert into public.notifications (user_id, type, title, body)
  values (recipient.id, 'lobby_contact_request', '有人想进一步联系', requester.nickname || '在看过你的个人主页后表达了联系意愿');
  return request_id;
end;
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
  other_real_name text,
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
    case when r.status = 'accepted' then private_details.real_name else null end,
    case when r.status = 'accepted' then cm.contact_type else null end,
    case when r.status = 'accepted' then cm.contact_value else null end
  from public.lobby_contact_requests r
  join public.profiles other_user on other_user.id = case
    when r.requester_id = auth.uid() then r.recipient_id else r.requester_id end
  left join public.profile_private_details private_details on private_details.user_id = other_user.id
  left join public.contact_methods cm on cm.user_id = other_user.id
  where auth.uid() in (r.requester_id, r.recipient_id)
  order by r.created_at desc;
$$;

revoke all on function public.open_direct_conversation(uuid) from public;
revoke all on function public.send_direct_message(uuid, text) from public;
revoke all on function public.mark_direct_messages_read(uuid) from public;
revoke all on function public.list_direct_conversations() from public;
revoke all on function public.list_direct_messages(uuid) from public;
revoke all on function public.request_lobby_contact(uuid) from public;
revoke all on function public.list_lobby_contact_links() from public;
grant execute on function public.open_direct_conversation(uuid) to authenticated;
grant execute on function public.send_direct_message(uuid, text) to authenticated;
grant execute on function public.mark_direct_messages_read(uuid) to authenticated;
grant execute on function public.list_direct_conversations() to authenticated;
grant execute on function public.list_direct_messages(uuid) to authenticated;
grant execute on function public.request_lobby_contact(uuid) to authenticated;
grant execute on function public.list_lobby_contact_links() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end;
$$;
