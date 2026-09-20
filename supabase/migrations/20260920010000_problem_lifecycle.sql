-- Owner-controlled problem resolution with an immutable lifecycle audit trail.
create table public.problem_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  event text not null check (event in ('solved','reopened')),
  created_at timestamptz not null default now()
);
create index problem_lifecycle_events_user_created_idx on public.problem_lifecycle_events(user_id,created_at desc);
create index problem_lifecycle_events_problem_created_idx on public.problem_lifecycle_events(problem_id,created_at desc);

alter table public.problem_lifecycle_events enable row level security;
revoke all on public.problem_lifecycle_events from public,anon,authenticated,service_role;
grant select on public.problem_lifecycle_events to authenticated;
create policy problem_lifecycle_events_select on public.problem_lifecycle_events for select to authenticated
  using (user_id=(select auth.uid()));

create function public.set_problem_resolution(p_problem_id uuid,p_solved boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.problems; next_status public.problem_status;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  if p_problem_id is null or p_solved is null then raise exception 'INVALID_INPUT'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  select * into item from public.problems where id=p_problem_id and user_id=auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if p_solved then
    if item.status='solved' then return jsonb_build_object('status',item.status,'solvedAt',item.solved_at); end if;
    if not exists(select 1 from public.web_runs where problem_id=item.id and user_id=auth.uid() and status='completed') then raise exception 'NOT_READY'; end if;
    update public.monitoring_conditions set status='paused',lease_until=null,updated_at=now()
      where problem_id=item.id and user_id=auth.uid() and status in ('active','checking');
    update public.problems set status='solved',solved_at=now() where id=item.id returning * into item;
    insert into public.problem_lifecycle_events(user_id,problem_id,event) values(auth.uid(),item.id,'solved');
  else
    if item.status<>'solved' then return jsonb_build_object('status',item.status,'solvedAt',item.solved_at); end if;
    next_status:=case when exists(select 1 from public.monitoring_conditions where problem_id=item.id and user_id=auth.uid() and status in ('active','checking')) then 'monitoring'::public.problem_status else 'evaluating'::public.problem_status end;
    update public.problems set status=next_status,solved_at=null where id=item.id returning * into item;
    insert into public.problem_lifecycle_events(user_id,problem_id,event) values(auth.uid(),item.id,'reopened');
  end if;
  return jsonb_build_object('status',item.status,'solvedAt',item.solved_at);
end;
$$;
revoke all on function public.set_problem_resolution(uuid,boolean) from public,anon;
grant execute on function public.set_problem_resolution(uuid,boolean) to authenticated;

-- A solved problem must be reopened explicitly before monitoring resumes.
create or replace function public.create_monitoring_condition(p_problem_id uuid,p_description text,p_search_query text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.monitoring_conditions; problem_state public.problem_status;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  if char_length(trim(p_description)) not between 10 and 1000 or char_length(trim(p_search_query)) not between 10 and 500 then raise exception 'INVALID_INPUT'; end if;
  select status into problem_state from public.problems where id=p_problem_id and user_id=auth.uid();
  if not found then raise exception 'NOT_FOUND'; end if;
  if problem_state='solved' then raise exception 'PROBLEM_SOLVED'; end if;
  if not exists(select 1 from public.web_runs where problem_id=p_problem_id and user_id=auth.uid() and status='completed') then raise exception 'NOT_READY'; end if;
  if (select count(*) from public.monitoring_conditions where user_id=auth.uid() and status in ('active','checking'))>=5 then raise exception 'MONITOR_LIMIT'; end if;
  insert into public.monitoring_conditions(user_id,problem_id,description,search_query)
    values(auth.uid(),p_problem_id,trim(p_description),trim(p_search_query)) returning * into item;
  update public.problems set status='monitoring',solved_at=null where id=p_problem_id;
  return jsonb_build_object('id',item.id,'problemId',item.problem_id,'description',item.description,'searchQuery',item.search_query,
    'status',item.status,'lastResult',item.last_result,'lastError',item.last_error,'lastCheckedAt',item.last_checked_at,'nextCheckAt',item.next_check_at);
end;
$$;

create or replace function public.set_monitoring_condition_status(p_condition_id uuid,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.monitoring_conditions; problem_state public.problem_status;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  if p_status not in ('active','paused') then raise exception 'INVALID_INPUT'; end if;
  select * into item from public.monitoring_conditions where id=p_condition_id and user_id=auth.uid();
  if not found then raise exception 'NOT_FOUND'; end if;
  select status into problem_state from public.problems where id=item.problem_id and user_id=auth.uid();
  if p_status='active' and problem_state='solved' then raise exception 'PROBLEM_SOLVED'; end if;
  if p_status='active' and (select count(*) from public.monitoring_conditions where user_id=auth.uid() and status in ('active','checking') and id<>p_condition_id)>=5 then raise exception 'MONITOR_LIMIT'; end if;
  update public.monitoring_conditions set status=p_status,updated_at=now(),
    next_check_at=case when p_status='active' then now() else next_check_at end,lease_until=null
    where id=p_condition_id and user_id=auth.uid() and status in ('active','paused','failed') returning * into item;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_status='active' then update public.problems set status='monitoring',solved_at=null where id=item.problem_id; end if;
  return jsonb_build_object('id',item.id,'problemId',item.problem_id,'description',item.description,'searchQuery',item.search_query,
    'status',item.status,'lastResult',item.last_result,'lastError',item.last_error,'lastCheckedAt',item.last_checked_at,'nextCheckAt',item.next_check_at);
end;
$$;

-- Account export version 3 includes the lifecycle audit trail.
create or replace function public.export_account_data() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  return jsonb_build_object(
    'version',3,'exportedAt',now(),
    'profile',(select to_jsonb(p) from public.profiles p where id=actor),
    'problems',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.problems p where user_id=actor),
    'web_runs',(select coalesce(jsonb_agg(to_jsonb(w)-'secret_token'),'[]'::jsonb) from public.web_runs w where user_id=actor),
    'constraints',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.constraints t where problem_id in (select id from public.problems where user_id=actor)),
    'unknowns',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.unknowns t where problem_id in (select id from public.problems where user_id=actor)),
    'plan_steps',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.plan_steps t where problem_id in (select id from public.problems where user_id=actor)),
    'plan_step_dependencies',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.plan_step_dependencies t where problem_id in (select id from public.problems where user_id=actor)),
    'research_items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.research_items t where problem_id in (select id from public.problems where user_id=actor)),
    'options',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.options t where problem_id in (select id from public.problems where user_id=actor)),
    'decisions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.decisions t where problem_id in (select id from public.problems where user_id=actor)),
    'tasks',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.tasks t where problem_id in (select id from public.problems where user_id=actor)),
    'risks',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.risks t where problem_id in (select id from public.problems where user_id=actor)),
    'agent_runs',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.agent_runs t where problem_id in (select id from public.problems where user_id=actor)),
    'workflow_runs',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.workflow_runs t where problem_id in (select id from public.problems where user_id=actor)),
    'full_workflow_runs',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.full_workflow_runs t where problem_id in (select id from public.problems where user_id=actor)),
    'human_requests',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.human_requests t where user_id=actor),
    'monitoring_conditions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.monitoring_conditions t where user_id=actor),
    'notifications',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.notifications t where user_id=actor),
    'notification_events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.notification_events t where user_id=actor),
    'notification_preferences',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.notification_preferences t where user_id=actor),
    'integrations',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.integrations t where user_id=actor),
    'integration_events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.integration_events t where user_id=actor),
    'external_actions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.external_actions t where user_id=actor),
    'external_action_events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.external_action_events t where user_id=actor),
    'problem_lifecycle_events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.problem_lifecycle_events t where user_id=actor),
    'product_events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.product_events t where user_id=actor)
  );
end;
$$;


