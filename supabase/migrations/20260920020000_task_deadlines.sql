-- Make generated tasks schedulable and publish one reminder per saved deadline.
alter table public.notification_preferences
  add column task_updates boolean not null default true;

alter table public.notification_events drop constraint notification_events_kind_check;
alter table public.notification_events add constraint notification_events_kind_check
  check(kind in ('analysis_completed','analysis_failed','input_required','condition_met','monitor_failed','task_due'));
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check(kind in ('analysis_completed','analysis_failed','input_required','condition_met','monitor_failed','task_due'));

create index tasks_due_active_idx on public.tasks(due_at)
  where due_at is not null and status in ('pending','in_progress');

create or replace function public.emit_notification_event(p_user uuid,p_problem uuid,p_kind text,p_key text) returns void
language plpgsql security definer set search_path='' as $$
declare event_id uuid; prefs public.notification_preferences; enabled boolean;
begin
  insert into public.notification_events(user_id,problem_id,kind,event_key) values(p_user,p_problem,p_kind,p_key)
    on conflict(event_key) do nothing returning id into event_id;
  if event_id is null then return; end if;
  select * into prefs from public.notification_preferences where user_id=p_user;
  enabled:=case when p_kind='input_required' then coalesce(prefs.action_required,true)
    when p_kind in ('condition_met','monitor_failed') then coalesce(prefs.monitoring_updates,true)
    when p_kind='task_due' then coalesce(prefs.task_updates,true)
    else coalesce(prefs.analysis_updates,true) end;
  if enabled then insert into public.notifications(id,user_id,problem_id,kind) values(event_id,p_user,p_problem,p_kind); end if;
end;
$$;
revoke all on function public.emit_notification_event(uuid,uuid,text,text) from public,anon,authenticated;

drop function public.save_notification_preferences(boolean,boolean,boolean);
create function public.save_notification_preferences(p_analysis boolean,p_action boolean,p_monitoring boolean,p_tasks boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  insert into public.notification_preferences(user_id,analysis_updates,action_required,monitoring_updates,task_updates)
    values(auth.uid(),p_analysis,p_action,p_monitoring,p_tasks)
    on conflict(user_id) do update set analysis_updates=excluded.analysis_updates,action_required=excluded.action_required,
      monitoring_updates=excluded.monitoring_updates,task_updates=excluded.task_updates;
end;
$$;
revoke all on function public.save_notification_preferences(boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.save_notification_preferences(boolean,boolean,boolean,boolean) to authenticated;

create function public.emit_due_task_notifications(p_limit integer default 100) returns integer
language plpgsql security definer set search_path='' as $$
declare item record; emitted integer:=0; event_key text;
begin
  if p_limit is null or p_limit<1 or p_limit>500 then raise exception 'INVALID_LIMIT'; end if;
  for item in
    select t.id,t.problem_id,t.due_at,p.user_id
    from public.tasks t join public.problems p on p.id=t.problem_id
    where t.status in ('pending','in_progress') and t.due_at is not null
      and t.due_at<=now()+interval '24 hours' and p.status<>'solved'
      and not exists (
        select 1 from public.notification_events e
        where e.event_key='task_due:'||t.id::text||':'||(extract(epoch from t.due_at)::bigint)::text
      )
    order by t.due_at,t.id limit p_limit
  loop
    event_key:='task_due:'||item.id::text||':'||(extract(epoch from item.due_at)::bigint)::text;
    perform public.emit_notification_event(item.user_id,item.problem_id,'task_due',event_key);
    emitted:=emitted+1;
  end loop;
  return emitted;
end;
$$;
revoke all on function public.emit_due_task_notifications(integer) from public,anon,authenticated;
grant execute on function public.emit_due_task_notifications(integer) to service_role;
