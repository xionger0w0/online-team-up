-- 普通聊天和招募信息都可以作为进入个人主页、表达联系意愿的入口。
-- 联系方式仍只会在对方同意后向双方显示。

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
  if requester.id is null or recipient.id is null then raise exception '请先填写简单资料'; end if;
  if requester.id = recipient.id then raise exception '不能向自己发送联系意愿'; end if;
  if requester.gender <> recipient.gender then raise exception '找舍友仅支持同性同学联系'; end if;

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

revoke all on function public.request_lobby_contact(uuid) from public;
grant execute on function public.request_lobby_contact(uuid) to authenticated;
