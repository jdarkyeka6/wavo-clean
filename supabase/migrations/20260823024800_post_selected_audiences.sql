create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check check (visibility in ('friends', 'selected'));

create table if not exists public.post_audience (
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id),
  constraint post_audience_not_self check (author_id <> user_id)
);
create index if not exists post_audience_user_idx on public.post_audience(user_id, post_id);
create index if not exists post_audience_author_idx on public.post_audience(author_id, post_id);
alter table public.post_audience enable row level security;
revoke all on table public.post_audience from anon, authenticated;
grant select, insert, delete on table public.post_audience to authenticated;

create or replace function private.can_view_post(p_post uuid, p_author uuid, p_visibility text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when u.uid is null then false
    when u.uid = p_author then true
    when exists (select 1 from public.blocks b where (b.blocker_id=u.uid and b.blocked_id=p_author) or (b.blocker_id=p_author and b.blocked_id=u.uid)) then false
    when not exists (select 1 from public.friend_requests fr where fr.status='accepted' and ((fr.sender_id=u.uid and fr.receiver_id=p_author) or (fr.receiver_id=u.uid and fr.sender_id=p_author))) then false
    when p_visibility='friends' then true
    when p_visibility='selected' then exists (select 1 from public.post_audience pa where pa.post_id=p_post and pa.author_id=p_author and pa.user_id=u.uid)
    else false
  end
  from (select auth.uid() as uid) u;
$$;

create or replace function private.can_manage_post_audience(p_post uuid, p_author uuid, p_recipient uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select u.uid is not null and u.uid=p_author and p_recipient<>p_author
    and exists (select 1 from public.posts p where p.id=p_post and p.author_id=p_author and p.visibility='selected')
    and exists (select 1 from public.friend_requests fr where fr.status='accepted' and ((fr.sender_id=p_author and fr.receiver_id=p_recipient) or (fr.receiver_id=p_author and fr.sender_id=p_recipient)))
    and not exists (select 1 from public.blocks b where (b.blocker_id=p_author and b.blocked_id=p_recipient) or (b.blocker_id=p_recipient and b.blocked_id=p_author))
  from (select auth.uid() as uid) u;
$$;

revoke all on function private.can_view_post(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.can_manage_post_audience(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function private.can_view_post(uuid, uuid, text) to authenticated;
grant execute on function private.can_manage_post_audience(uuid, uuid, uuid) to authenticated;

drop policy if exists "friends can view posts" on public.posts;
drop policy if exists "friends or selected people can view posts" on public.posts;
create policy "friends or selected people can view posts" on public.posts for select to authenticated
using ((select private.can_view_post(id, author_id, visibility)));

create policy "authors and recipients can view post audience" on public.post_audience for select to authenticated
using ((select auth.uid())=author_id or (select auth.uid())=user_id);
create policy "authors can add selected post audience" on public.post_audience for insert to authenticated
with check ((select private.can_manage_post_audience(post_id, author_id, user_id)));
create policy "authors can remove selected post audience" on public.post_audience for delete to authenticated
using ((select auth.uid())=author_id);
