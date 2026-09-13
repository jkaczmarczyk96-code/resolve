-- Read-only Google integrations. Credentials are encrypted by the application and
-- stored outside the exposed public schema; users can only read connection metadata.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google')),
  status text not null default 'connected' check (status in ('connected','disconnected','error')),
  account_email text not null check (char_length(account_email) between 3 and 320),
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
create index integrations_user_status_idx on public.integrations(user_id, status);

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.integrations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('connected','refreshed','calendar_read','gmail_read','disconnected','error')),
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index integration_events_user_created_idx on public.integration_events(user_id, created_at desc);
create index integration_events_integration_idx on public.integration_events(integration_id);

create table private.integration_credentials (
  integration_id uuid primary key references public.integrations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  token_expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index integration_credentials_user_idx on private.integration_credentials(user_id);
revoke all on private.integration_credentials from public, anon, authenticated;
grant select, insert, update, delete on private.integration_credentials to service_role;

alter table public.integrations enable row level security;
alter table public.integration_events enable row level security;
revoke all on public.integrations, public.integration_events from public, anon, authenticated;
grant select on public.integrations, public.integration_events to authenticated;
create policy integrations_select on public.integrations for select to authenticated
  using (user_id = (select auth.uid()));
create policy integration_events_select on public.integration_events for select to authenticated
  using (user_id = (select auth.uid()));

create function public.save_google_integration(
  p_email text,
  p_scopes text[],
  p_access_ciphertext text,
  p_refresh_ciphertext text,
  p_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); integration uuid;
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  if p_email is null or char_length(p_email) not between 3 and 320 or position('@' in p_email) < 2 then raise exception 'INVALID_EMAIL'; end if;
  if p_scopes is null or not p_scopes <@ array[
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/gmail.readonly'
  ]::text[] or not p_scopes @> array[
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/gmail.readonly'
  ]::text[] then raise exception 'INVALID_SCOPES'; end if;
  if cardinality(p_scopes) <> 2 then raise exception 'INVALID_SCOPES'; end if;
  if char_length(coalesce(p_access_ciphertext,'')) not between 32 and 16384 then raise exception 'INVALID_CREDENTIAL'; end if;
  if char_length(coalesce(p_refresh_ciphertext,'')) not between 32 and 16384 then raise exception 'INVALID_CREDENTIAL'; end if;
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '2 hours' then raise exception 'INVALID_EXPIRY'; end if;

  insert into public.integrations(user_id,provider,status,account_email,scopes,connected_at,disconnected_at,updated_at)
  values(actor,'google','connected',p_email,p_scopes,now(),null,now())
  on conflict(user_id,provider) do update set
    status='connected', account_email=excluded.account_email, scopes=excluded.scopes,
    connected_at=now(), disconnected_at=null, updated_at=now()
  returning id into integration;

  insert into private.integration_credentials(integration_id,user_id,access_token_ciphertext,refresh_token_ciphertext,token_expires_at)
  values(integration,actor,p_access_ciphertext,p_refresh_ciphertext,p_expires_at)
  on conflict(integration_id) do update set
    user_id=excluded.user_id, access_token_ciphertext=excluded.access_token_ciphertext,
    refresh_token_ciphertext=excluded.refresh_token_ciphertext,
    token_expires_at=excluded.token_expires_at, updated_at=now();

  insert into public.integration_events(integration_id,user_id,action,detail)
  values(integration,actor,'connected',jsonb_build_object('scopes',p_scopes));
  return integration;
end;
$$;

create function public.disconnect_google_integration(p_remote_revoked boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); integration uuid;
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  select id into integration from public.integrations where user_id=actor and provider='google' and status='connected';
  if integration is null then return false; end if;
  delete from private.integration_credentials where integration_id=integration and user_id=actor;
  update public.integrations set status='disconnected',disconnected_at=now(),updated_at=now() where id=integration;
  insert into public.integration_events(integration_id,user_id,action,detail)
  values(integration,actor,'disconnected',jsonb_build_object('remoteRevoked',coalesce(p_remote_revoked,false)));
  return true;
end;
$$;

create function public.get_google_integration_credential(p_user uuid) returns jsonb
language sql security definer set search_path='' stable as $$
  select jsonb_build_object(
    'integrationId',i.id,
    'accessTokenCiphertext',c.access_token_ciphertext,
    'refreshTokenCiphertext',c.refresh_token_ciphertext,
    'expiresAt',c.token_expires_at
  )
  from public.integrations i
  join private.integration_credentials c on c.integration_id=i.id and c.user_id=i.user_id
  where i.user_id=p_user and i.provider='google' and i.status='connected'
$$;

create function public.update_google_integration_access(p_user uuid,p_access_ciphertext text,p_expires_at timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare integration uuid;
begin
  if char_length(coalesce(p_access_ciphertext,'')) not between 32 and 16384 then raise exception 'INVALID_CREDENTIAL'; end if;
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '2 hours' then raise exception 'INVALID_EXPIRY'; end if;
  update private.integration_credentials c set access_token_ciphertext=p_access_ciphertext,token_expires_at=p_expires_at,updated_at=now()
    from public.integrations i where c.integration_id=i.id and i.id=c.integration_id and i.user_id=p_user and i.provider='google' and i.status='connected'
    returning i.id into integration;
  if integration is null then return false; end if;
  update public.integrations set updated_at=now() where id=integration;
  insert into public.integration_events(integration_id,user_id,action) values(integration,p_user,'refreshed');
  return true;
end;
$$;

create function public.record_google_integration_event(p_user uuid,p_action text,p_detail jsonb default '{}') returns boolean
language plpgsql security definer set search_path='' as $$
declare integration uuid;
begin
  if p_action not in ('calendar_read','gmail_read','error') then raise exception 'INVALID_ACTION'; end if;
  select id into integration from public.integrations where user_id=p_user and provider='google' and status='connected';
  if integration is null then return false; end if;
  insert into public.integration_events(integration_id,user_id,action,detail)
  values(integration,p_user,p_action,coalesce(p_detail,'{}'::jsonb));
  update public.integrations set last_synced_at=now(),updated_at=now() where id=integration;
  return true;
end;
$$;

revoke all on function public.save_google_integration(text,text[],text,text,timestamptz),
  public.disconnect_google_integration(boolean),public.get_google_integration_credential(uuid),
  public.update_google_integration_access(uuid,text,timestamptz),public.record_google_integration_event(uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.save_google_integration(text,text[],text,text,timestamptz),
  public.disconnect_google_integration(boolean) to authenticated;
grant execute on function public.get_google_integration_credential(uuid),
  public.update_google_integration_access(uuid,text,timestamptz),public.record_google_integration_event(uuid,text,jsonb)
  to service_role;

-- Extend account exports with connection metadata and audit events, never credentials.
create or replace function public.export_account_data() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  return jsonb_build_object(
    'version',1,
    'exportedAt',now(),
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
    'integration_events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.integration_events t where user_id=actor)
  );
end;
$$;
