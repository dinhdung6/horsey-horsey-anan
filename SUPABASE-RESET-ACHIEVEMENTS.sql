create or replace function public.reset_own_achievements()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (select 1 from public.messages where is_active) then
    raise exception 'There are no active messages to reset';
  end if;

  if exists (
    select 1
    from public.messages as message
    where message.is_active
      and not exists (
        select 1
        from public.player_achievements as achievement
        where achievement.user_id = current_user_id
          and achievement.message_id = message.id
      )
  ) then
    raise exception 'All active messages must be found before resetting progress';
  end if;

  delete from public.player_achievements
  where user_id = current_user_id;
end;
$$;

revoke all on function public.reset_own_achievements() from public, anon;
grant execute on function public.reset_own_achievements() to authenticated;

notify pgrst, 'reload schema';
