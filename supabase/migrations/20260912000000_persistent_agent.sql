-- Phase 10: recover finite workflows from their last validated checkpoint.
alter table public.web_runs
  add column recovery_count smallint not null default 0 check (recovery_count between 0 and 3),
  add column last_heartbeat_at timestamptz;

create index web_runs_recoverable_idx on public.web_runs(expires_at)
  where status in ('queued','running');

create function public.recover_web_run(p_run_id uuid, p_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.web_runs; checkpoint_state text;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  select * into job from public.web_runs
    where id=p_run_id and user_id=auth.uid() and secret_token=p_secret for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if job.status='queued' then
    if job.expires_at<=now() then
      if job.recovery_count>=3 then return null; end if;
      update public.web_runs set expires_at=now()+interval '20 minutes',recovery_count=recovery_count+1,
        last_heartbeat_at=now() where id=job.id returning * into job;
    end if;
    return jsonb_build_object('id',job.id,'problemId',job.problem_id,'status',job.status,'error',job.error,'expiresAt',job.expires_at);
  end if;
  if job.status<>'running' or job.expires_at>now() then raise exception 'NOT_RECOVERABLE'; end if;
  select state into checkpoint_state from public.full_workflow_runs where id=job.id and problem_id=job.problem_id;
  if checkpoint_state is null or checkpoint_state in ('ACTION_REQUIRED','COMPLETED','FAILED','CANCELLED') or job.recovery_count>=3 then
    update public.web_runs set status='failed',error='INTERRUPTED' where id=job.id;
    return null;
  end if;
  update public.web_runs set status='queued',error=null,recovery_count=recovery_count+1,
    expires_at=now()+interval '20 minutes',last_heartbeat_at=now()
    where id=job.id returning * into job;
  return jsonb_build_object('id',job.id,'problemId',job.problem_id,'status',job.status,'error',job.error,'expiresAt',job.expires_at);
end;
$$;

create function public.yield_web_run(p_run_id uuid, p_secret text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  update public.web_runs set status='queued',error=null,recovery_count=recovery_count+1,
    expires_at=now()+interval '20 minutes',last_heartbeat_at=now()
    where id=p_run_id and user_id=auth.uid() and secret_token=p_secret and status='running'
      and recovery_count<3 and exists (
        select 1 from public.full_workflow_runs f where f.id=p_run_id
          and f.state not in ('ACTION_REQUIRED','COMPLETED','FAILED','CANCELLED')
      );
  return found;
end;
$$;

create or replace function public.claim_web_run(p_run_id uuid,p_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.web_runs; continuation jsonb; has_checkpoint boolean;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  update public.web_runs set status='running',last_heartbeat_at=now()
    where id=p_run_id and user_id=auth.uid() and secret_token=p_secret and status='queued'
      and expires_at>now() and problem_id is not null returning * into job;
  if not found then return null; end if;
  select jsonb_build_object('checkpoint',checkpoint,'responseId',response_id,'answers',answers)
    into continuation from public.human_requests where run_id=job.id and response_id is not null;
  select exists(select 1 from public.full_workflow_runs where id=job.id) into has_checkpoint;
  return jsonb_build_object('id',job.id,'problemId',job.problem_id,'status',job.status,'error',job.error,
    'expiresAt',job.expires_at,'resume',continuation,'recover',has_checkpoint and continuation is null);
end;
$$;

revoke all on function public.recover_web_run(uuid,text),public.yield_web_run(uuid,text) from public,anon;
grant execute on function public.recover_web_run(uuid,text),public.yield_web_run(uuid,text) to authenticated;

create table public.monitoring_conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 10 and 1000),
  search_query text not null check (char_length(trim(search_query)) between 10 and 500),
  status text not null default 'active' check (status in ('active','checking','met','paused','failed')),
  last_result jsonb check (last_result is null or (jsonb_typeof(last_result)='object' and octet_length(last_result::text)<=32000)),
  last_error text check (last_error is null or last_error in ('PROVIDER','TIMEOUT','INVALID_OUTPUT','RATE_LIMIT','PERSISTENCE')),
  last_checked_at timestamptz,
  next_check_at timestamptz not null default now(),
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index monitoring_conditions_user_problem_idx on public.monitoring_conditions(user_id,problem_id,created_at desc);
create index monitoring_conditions_due_idx on public.monitoring_conditions(next_check_at) where status='active';
alter table public.monitoring_conditions enable row level security;
revoke all on public.monitoring_conditions from public,anon,authenticated;
grant select on public.monitoring_conditions to authenticated;
create policy monitoring_conditions_select on public.monitoring_conditions for select to authenticated
  using (user_id=(select auth.uid()));

create function public.create_monitoring_condition(p_problem_id uuid,p_description text,p_search_query text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.monitoring_conditions;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  if char_length(trim(p_description)) not between 10 and 1000 or char_length(trim(p_search_query)) not between 10 and 500 then raise exception 'INVALID_INPUT'; end if;
  if not exists(select 1 from public.problems where id=p_problem_id and user_id=auth.uid()) then raise exception 'NOT_FOUND'; end if;
  if not exists(select 1 from public.web_runs where problem_id=p_problem_id and user_id=auth.uid() and status='completed') then raise exception 'NOT_READY'; end if;
  if (select count(*) from public.monitoring_conditions where user_id=auth.uid() and status in ('active','checking'))>=5 then raise exception 'MONITOR_LIMIT'; end if;
  insert into public.monitoring_conditions(user_id,problem_id,description,search_query)
    values(auth.uid(),p_problem_id,trim(p_description),trim(p_search_query)) returning * into item;
  update public.problems set status='monitoring' where id=p_problem_id;
  return jsonb_build_object('id',item.id,'problemId',item.problem_id,'description',item.description,'searchQuery',item.search_query,
    'status',item.status,'lastResult',item.last_result,'lastError',item.last_error,'lastCheckedAt',item.last_checked_at,'nextCheckAt',item.next_check_at);
end;
$$;

create function public.set_monitoring_condition_status(p_condition_id uuid,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.monitoring_conditions;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  if p_status not in ('active','paused') then raise exception 'INVALID_INPUT'; end if;
  if p_status='active' and (select count(*) from public.monitoring_conditions where user_id=auth.uid() and status in ('active','checking') and id<>p_condition_id)>=5 then raise exception 'MONITOR_LIMIT'; end if;
  update public.monitoring_conditions set status=p_status,updated_at=now(),
    next_check_at=case when p_status='active' then now() else next_check_at end,lease_until=null
    where id=p_condition_id and user_id=auth.uid() and status in ('active','paused','failed') returning * into item;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('id',item.id,'problemId',item.problem_id,'description',item.description,'searchQuery',item.search_query,
    'status',item.status,'lastResult',item.last_result,'lastError',item.last_error,'lastCheckedAt',item.last_checked_at,'nextCheckAt',item.next_check_at);
end;
$$;

create function public.claim_due_monitoring_conditions(p_limit integer default 2) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  with due as (
    select id from public.monitoring_conditions
    where (status='active' and next_check_at<=now()) or (status='checking' and lease_until<=now())
    order by next_check_at for update skip locked limit least(greatest(p_limit,1),2)
  ), claimed as (
    update public.monitoring_conditions m set status='checking',lease_until=now()+interval '4 minutes',updated_at=now()
    from due where m.id=due.id
    returning m.id,m.problem_id,m.description,m.search_query
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'problemId',problem_id,'description',description,'searchQuery',search_query)),'[]'::jsonb) into result from claimed;
  return result;
end;
$$;

create function public.finish_monitoring_condition(p_condition_id uuid,p_outcome text,p_result jsonb,p_error text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare item public.monitoring_conditions;
begin
  if p_outcome not in ('met','not_met','uncertain','failed') or (p_result is not null and (jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>32000)) then raise exception 'INVALID_INPUT'; end if;
  update public.monitoring_conditions set
    status=case when p_outcome='met' then 'met' when p_outcome='failed' then 'failed' else 'active' end,
    last_result=p_result,last_error=case when p_outcome='failed' then coalesce(p_error,'PROVIDER') else null end,
    last_checked_at=now(),next_check_at=now()+interval '1 day',lease_until=null,updated_at=now()
    where id=p_condition_id and status='checking' and lease_until>now() returning * into item;
  if not found then return false; end if;
  if p_outcome='met' then update public.problems set status='action_required',current_priority='A monitored condition was met. Review the new evidence.' where id=item.problem_id; end if;
  return true;
end;
$$;

revoke all on function public.create_monitoring_condition(uuid,text,text),public.set_monitoring_condition_status(uuid,text) from public,anon;
grant execute on function public.create_monitoring_condition(uuid,text,text),public.set_monitoring_condition_status(uuid,text) to authenticated;
revoke all on function public.claim_due_monitoring_conditions(integer),public.finish_monitoring_condition(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_due_monitoring_conditions(integer),public.finish_monitoring_condition(uuid,text,jsonb,text) to service_role;
