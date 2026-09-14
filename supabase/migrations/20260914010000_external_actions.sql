-- Phase 14: explicit approval and an immutable audit trail for external writes.
create table public.external_actions (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  integration_id uuid not null references public.integrations(id),
  request_id uuid not null,
  action_type text not null check (action_type in ('calendar_create_event')),
  status text not null default 'proposed' check (status in ('proposed','executing','succeeded','failed','cancelled')),
  payload jsonb not null,
  result jsonb,
  error text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  executed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id,request_id)
);
create index external_actions_problem_created_idx on public.external_actions(problem_id,requested_at desc);
create index external_actions_user_status_idx on public.external_actions(user_id,status,updated_at);

create table public.external_action_events (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity unique,
  action_id uuid not null references public.external_actions(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null check (event in ('proposed','approved','execution_started','succeeded','failed','cancelled')),
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index external_action_events_action_sequence_idx on public.external_action_events(action_id,sequence);
create index external_action_events_user_created_idx on public.external_action_events(user_id,created_at desc);

alter table public.external_actions enable row level security;
alter table public.external_action_events enable row level security;
revoke all on public.external_actions,public.external_action_events from public,anon,authenticated;
revoke all on public.external_actions,public.external_action_events from service_role;
grant select on public.external_actions,public.external_action_events to authenticated;
create policy external_actions_select on public.external_actions for select to authenticated
  using (user_id=(select auth.uid()));
create policy external_action_events_select on public.external_action_events for select to authenticated
  using (user_id=(select auth.uid()));

create function public.propose_calendar_action(p_problem_id uuid,p_request_id uuid,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); integration uuid; existing public.external_actions; action uuid; start_at timestamptz; end_at timestamptz;
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  if p_problem_id is null or p_request_id is null or jsonb_typeof(p_payload)<>'object' then raise exception 'INVALID_ACTION'; end if;
  if exists(select 1 from jsonb_object_keys(p_payload) key where key not in ('summary','description','location','start','end'))
    or char_length(btrim(coalesce(p_payload->>'summary',''))) not between 1 and 200
    or char_length(coalesce(p_payload->>'description',''))>2000
    or char_length(coalesce(p_payload->>'location',''))>500
    then raise exception 'INVALID_ACTION'; end if;
  begin start_at:=(p_payload->>'start')::timestamptz; end_at:=(p_payload->>'end')::timestamptz;
  exception when others then raise exception 'INVALID_ACTION'; end;
  if start_at<now()-interval '5 minutes' or end_at<=start_at or end_at>start_at+interval '7 days' then raise exception 'INVALID_ACTION'; end if;

  select * into existing from public.external_actions where user_id=actor and request_id=p_request_id;
  if found then
    if existing.problem_id<>p_problem_id or existing.action_type<>'calendar_create_event' or existing.payload<>p_payload then raise exception 'REQUEST_CONFLICT'; end if;
    return existing.id;
  end if;
  if not exists(select 1 from public.web_runs where problem_id=p_problem_id and user_id=actor and status='completed') then raise exception 'NOT_READY'; end if;
  select id into integration from public.integrations where user_id=actor and provider='google' and status='connected'
    and 'calendar'=any(enabled_services) and 'https://www.googleapis.com/auth/calendar.readonly'=any(scopes);
  if integration is null then raise exception 'INTEGRATION_NOT_CONNECTED'; end if;
  if (select count(*) from public.external_actions where user_id=actor and status in ('proposed','executing','failed'))>=10 then raise exception 'ACTION_LIMIT'; end if;
  insert into public.external_actions(problem_id,user_id,integration_id,request_id,action_type,payload)
    values(p_problem_id,actor,integration,p_request_id,'calendar_create_event',p_payload)
    on conflict(user_id,request_id) do nothing returning id into action;
  if action is null then
    select * into existing from public.external_actions where user_id=actor and request_id=p_request_id;
    if not found or existing.problem_id<>p_problem_id or existing.action_type<>'calendar_create_event' or existing.payload<>p_payload then raise exception 'REQUEST_CONFLICT'; end if;
    return existing.id;
  end if;
  insert into public.external_action_events(action_id,problem_id,user_id,event,detail)
    values(action,p_problem_id,actor,'proposed',jsonb_build_object('actionType','calendar_create_event'));
  return action;
end;
$$;

create function public.claim_external_action(p_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); action public.external_actions; available boolean;
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  select * into action from public.external_actions where id=p_action_id and user_id=actor for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if action.status='succeeded' then
    return jsonb_build_object('id',action.id,'problemId',action.problem_id,'actionType',action.action_type,'status',action.status,'payload',action.payload,'result',action.result,'alreadyCompleted',true);
  end if;
  if action.status='executing' and action.updated_at>now()-interval '30 seconds' then raise exception 'ACTION_IN_PROGRESS'; end if;
  if action.status not in ('proposed','failed','executing') or action.attempt_count>=5 then raise exception 'INVALID_ACTION_STATE'; end if;
  select exists(select 1 from public.integrations where id=action.integration_id and user_id=actor and provider='google' and status='connected'
    and 'calendar'=any(enabled_services)
    and 'https://www.googleapis.com/auth/calendar.events.owned'=any(scopes)) into available;
  if not available then raise exception 'WRITE_PERMISSION_REQUIRED'; end if;
  update public.external_actions set status='executing',approved_at=now(),executed_at=null,error=null,
    attempt_count=attempt_count+1,updated_at=now() where id=action.id returning * into action;
  insert into public.external_action_events(action_id,problem_id,user_id,event,detail) values
    (action.id,action.problem_id,actor,'approved',jsonb_build_object('attempt',action.attempt_count)),
    (action.id,action.problem_id,actor,'execution_started',jsonb_build_object('attempt',action.attempt_count));
  return jsonb_build_object('id',action.id,'problemId',action.problem_id,'actionType',action.action_type,'status',action.status,'payload',action.payload,'result',action.result,'alreadyCompleted',false);
end;
$$;

create function public.cancel_external_action(p_action_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); action public.external_actions;
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  update public.external_actions set status='cancelled',updated_at=now() where id=p_action_id and user_id=actor and status in ('proposed','failed') returning * into action;
  if not found then return false; end if;
  insert into public.external_action_events(action_id,problem_id,user_id,event) values(action.id,action.problem_id,actor,'cancelled');
  return true;
end;
$$;

create function public.finish_external_action(p_user uuid,p_action_id uuid,p_success boolean,p_result jsonb,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare action public.external_actions;
begin
  if p_user is null or p_action_id is null or p_success is null then raise exception 'INVALID_ACTION'; end if;
  if p_result is not null and (jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>8000) then raise exception 'INVALID_RESULT'; end if;
  if char_length(coalesce(p_error,''))>100 then raise exception 'INVALID_ERROR'; end if;
  select * into action from public.external_actions where id=p_action_id and user_id=p_user for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if action.status='succeeded' and p_success then
    return jsonb_build_object('id',action.id,'status',action.status,'result',action.result);
  end if;
  if action.status<>'executing' then raise exception 'INVALID_ACTION_STATE'; end if;
  update public.external_actions set status=case when p_success then 'succeeded' else 'failed' end,
    result=case when p_success then coalesce(p_result,'{}'::jsonb) else null end,
    error=case when p_success then null else coalesce(nullif(p_error,''),'ACTION_FAILED') end,
    executed_at=now(),updated_at=now() where id=action.id returning * into action;
  insert into public.external_action_events(action_id,problem_id,user_id,event,detail)
    values(action.id,action.problem_id,p_user,case when p_success then 'succeeded' else 'failed' end,
      case when p_success then jsonb_build_object('result',action.result) else jsonb_build_object('error',action.error) end);
  return jsonb_build_object('id',action.id,'status',action.status,'result',action.result,'error',action.error);
end;
$$;

revoke all on function public.propose_calendar_action(uuid,uuid,jsonb),public.claim_external_action(uuid),
  public.cancel_external_action(uuid),public.finish_external_action(uuid,uuid,boolean,jsonb,text) from public,anon,authenticated;
grant execute on function public.propose_calendar_action(uuid,uuid,jsonb),public.claim_external_action(uuid),public.cancel_external_action(uuid) to authenticated;
grant execute on function public.finish_external_action(uuid,uuid,boolean,jsonb,text) to service_role;

-- Allow the narrow event-write grant while keeping read services independently enabled.
create or replace function public.save_google_integration(
  p_email text,p_scopes text[],p_enabled_services text[],p_access_ciphertext text,p_refresh_ciphertext text,p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); integration uuid;
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  if p_email is null or char_length(p_email) not between 3 and 320 or position('@' in p_email)<2 then raise exception 'INVALID_EMAIL'; end if;
  if p_scopes is null or cardinality(p_scopes) not between 1 and 3 or array_position(p_scopes,null) is not null
    or not p_scopes<@array['https://www.googleapis.com/auth/calendar.readonly','https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/calendar.events.owned']::text[]
    or cardinality(p_scopes)<>(select count(distinct value) from unnest(p_scopes) value) then raise exception 'INVALID_SCOPES'; end if;
  if p_enabled_services is null or cardinality(p_enabled_services) not between 1 and 2 or array_position(p_enabled_services,null) is not null
    or not p_enabled_services<@array['calendar','gmail']::text[]
    or cardinality(p_enabled_services)<>(select count(distinct value) from unnest(p_enabled_services) value) then raise exception 'INVALID_SERVICES'; end if;
  if ('calendar'=any(p_enabled_services) and not ('https://www.googleapis.com/auth/calendar.readonly'=any(p_scopes)))
    or ('gmail'=any(p_enabled_services) and not ('https://www.googleapis.com/auth/gmail.readonly'=any(p_scopes)))
    or ('https://www.googleapis.com/auth/calendar.events.owned'=any(p_scopes) and not ('https://www.googleapis.com/auth/calendar.readonly'=any(p_scopes)))
    then raise exception 'INVALID_SCOPES'; end if;
  if char_length(coalesce(p_access_ciphertext,'')) not between 32 and 16384 or char_length(coalesce(p_refresh_ciphertext,'')) not between 32 and 16384 then raise exception 'INVALID_CREDENTIAL'; end if;
  if p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '2 hours' then raise exception 'INVALID_EXPIRY'; end if;
  insert into public.integrations(user_id,provider,status,account_email,scopes,enabled_services,connected_at,disconnected_at,updated_at)
    values(actor,'google','connected',p_email,p_scopes,p_enabled_services,now(),null,now())
  on conflict(user_id,provider) do update set status='connected',account_email=excluded.account_email,scopes=excluded.scopes,
    enabled_services=excluded.enabled_services,connected_at=now(),disconnected_at=null,updated_at=now() returning id into integration;
  insert into private.integration_credentials(integration_id,user_id,access_token_ciphertext,refresh_token_ciphertext,token_expires_at)
    values(integration,actor,p_access_ciphertext,p_refresh_ciphertext,p_expires_at)
  on conflict(integration_id) do update set user_id=excluded.user_id,access_token_ciphertext=excluded.access_token_ciphertext,
    refresh_token_ciphertext=excluded.refresh_token_ciphertext,token_expires_at=excluded.token_expires_at,updated_at=now();
  insert into public.integration_events(integration_id,user_id,action,detail)
    values(integration,actor,'connected',jsonb_build_object('scopes',p_scopes,'enabledServices',p_enabled_services));
  return integration;
end;
$$;

create or replace function public.get_google_integration_credential(p_user uuid) returns jsonb
language sql security definer set search_path='' stable as $$
  select jsonb_build_object('integrationId',i.id,'accessTokenCiphertext',c.access_token_ciphertext,
    'refreshTokenCiphertext',c.refresh_token_ciphertext,'expiresAt',c.token_expires_at,
    'enabledServices',i.enabled_services,'authorizedScopes',i.scopes)
  from public.integrations i join private.integration_credentials c on c.integration_id=i.id and c.user_id=i.user_id
  where i.user_id=p_user and i.provider='google' and i.status='connected'
$$;

-- Account exports include action requests and audit entries, never provider credentials.
create or replace function public.export_account_data() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  return jsonb_build_object(
    'version',1,'exportedAt',now(),
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
    'external_action_events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.external_action_events t where user_id=actor)
  );
end;
$$;
