-- Persist domain events atomically with the transitions that produce them.
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  analysis_updates boolean not null default true,
  action_required boolean not null default true,
  monitoring_updates boolean not null default true
);
create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  kind text not null check(kind in ('analysis_completed','analysis_failed','input_required','condition_met','monitor_failed')),
  event_key text not null unique,
  created_at timestamptz not null default now()
);
create index notification_events_user_idx on public.notification_events(user_id,created_at desc);
create index notification_events_problem_idx on public.notification_events(problem_id);
create table public.notifications (
  id uuid primary key references public.notification_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  kind text not null check(kind in ('analysis_completed','analysis_failed','input_required','condition_met','monitor_failed')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_created_idx on public.notifications(user_id,created_at desc,id);
create index notifications_problem_idx on public.notifications(problem_id);
alter table public.notification_preferences enable row level security;
alter table public.notification_events enable row level security;
alter table public.notifications enable row level security;
revoke all on public.notification_preferences,public.notification_events,public.notifications from public,anon,authenticated;
grant select on public.notification_preferences,public.notifications to authenticated;
create policy notification_preferences_select on public.notification_preferences for select to authenticated using(user_id=(select auth.uid()));
create policy notifications_select on public.notifications for select to authenticated using(user_id=(select auth.uid()));

create function public.emit_notification_event(p_user uuid,p_problem uuid,p_kind text,p_key text) returns void
language plpgsql security definer set search_path='' as $$
declare event_id uuid; prefs public.notification_preferences; enabled boolean;
begin
  insert into public.notification_events(user_id,problem_id,kind,event_key) values(p_user,p_problem,p_kind,p_key)
    on conflict(event_key) do nothing returning id into event_id;
  if event_id is null then return; end if;
  select * into prefs from public.notification_preferences where user_id=p_user;
  enabled:=case when p_kind='input_required' then coalesce(prefs.action_required,true)
    when p_kind in ('condition_met','monitor_failed') then coalesce(prefs.monitoring_updates,true)
    else coalesce(prefs.analysis_updates,true) end;
  if enabled then insert into public.notifications(id,user_id,problem_id,kind) values(event_id,p_user,p_problem,p_kind); end if;
end;
$$;
revoke all on function public.emit_notification_event(uuid,uuid,text,text) from public,anon,authenticated;

create function public.notify_web_transition() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text;
begin
  if new.problem_id is null or new.status=old.status then return new; end if;
  kind:=case new.status when 'completed' then 'analysis_completed' when 'failed' then 'analysis_failed' when 'action_required' then 'input_required' end;
  if kind is not null then perform public.emit_notification_event(new.user_id,new.problem_id,kind,'run:'||new.id::text||':'||kind); end if;
  return new;
end;
$$;
create trigger web_run_notifications after update of status on public.web_runs for each row execute function public.notify_web_transition();
create function public.notify_monitor_transition() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text;
begin
  if new.status=old.status then return new; end if;
  kind:=case new.status when 'met' then 'condition_met' when 'failed' then 'monitor_failed' end;
  if kind is not null then perform public.emit_notification_event(new.user_id,new.problem_id,kind,'monitor:'||new.id::text||':'||kind||':'||coalesce(new.last_checked_at::text,'')); end if;
  return new;
end;
$$;
create trigger monitor_notifications after update of status on public.monitoring_conditions for each row execute function public.notify_monitor_transition();

create function public.save_notification_preferences(p_analysis boolean,p_action boolean,p_monitoring boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  insert into public.notification_preferences(user_id,analysis_updates,action_required,monitoring_updates)
    values(auth.uid(),p_analysis,p_action,p_monitoring)
    on conflict(user_id) do update set analysis_updates=excluded.analysis_updates,action_required=excluded.action_required,monitoring_updates=excluded.monitoring_updates;
end;
$$;
create function public.read_notification(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  update public.notifications set read_at=coalesce(read_at,now()) where id=p_id and user_id=auth.uid();
  return found;
end;
$$;
revoke all on function public.save_notification_preferences(boolean,boolean,boolean),public.read_notification(uuid) from public,anon;
grant execute on function public.save_notification_preferences(boolean,boolean,boolean),public.read_notification(uuid) to authenticated;

-- A resumed run may already have advanced past its original clarification snapshot.
create or replace function public.claim_web_run(p_run_id uuid,p_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.web_runs; continuation jsonb; checkpoint_state text;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  update public.web_runs set status='running',last_heartbeat_at=now()
    where id=p_run_id and user_id=auth.uid() and secret_token=p_secret and status='queued'
      and expires_at>now() and problem_id is not null returning * into job;
  if not found then return null; end if;
  select state into checkpoint_state from public.full_workflow_runs where id=job.id;
  if checkpoint_state='ACTION_REQUIRED' then
    select jsonb_build_object('checkpoint',checkpoint,'responseId',response_id,'answers',answers)
      into continuation from public.human_requests where run_id=job.id and response_id is not null;
  end if;
  return jsonb_build_object('id',job.id,'problemId',job.problem_id,'status',job.status,'error',job.error,
    'expiresAt',job.expires_at,'resume',continuation,'recover',checkpoint_state is not null and continuation is null);
end;
$$;
