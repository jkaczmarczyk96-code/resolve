-- Track provider authorization separately from the services the user enabled in Avenli.
alter table public.integrations add column enabled_services text[] not null default '{}';
alter table public.integrations add constraint integrations_enabled_services_check
  check (enabled_services <@ array['calendar','gmail']::text[] and cardinality(enabled_services) <= 2);

update public.integrations set enabled_services = array_remove(array[
  case when 'https://www.googleapis.com/auth/calendar.readonly' = any(scopes) then 'calendar' end,
  case when 'https://www.googleapis.com/auth/gmail.readonly' = any(scopes) then 'gmail' end
],null);

alter table public.integration_events drop constraint integration_events_action_check;
alter table public.integration_events add constraint integration_events_action_check
  check (action in ('connected','refreshed','calendar_read','gmail_read','service_enabled','service_disabled','disconnected','error'));

drop function public.save_google_integration(text,text[],text,text,timestamptz);
create function public.save_google_integration(
  p_email text,
  p_scopes text[],
  p_enabled_services text[],
  p_access_ciphertext text,
  p_refresh_ciphertext text,
  p_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); integration uuid; expected_scopes text[];
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  if p_email is null or char_length(p_email) not between 3 and 320 or position('@' in p_email) < 2 then raise exception 'INVALID_EMAIL'; end if;
  if p_enabled_services is null or cardinality(p_enabled_services) not between 1 and 2
    or not p_enabled_services <@ array['calendar','gmail']::text[]
    or (cardinality(p_enabled_services)=2 and not ('calendar'=any(p_enabled_services) and 'gmail'=any(p_enabled_services)))
    then raise exception 'INVALID_SERVICES'; end if;
  expected_scopes := array_remove(array[
    case when 'calendar'=any(p_enabled_services) then 'https://www.googleapis.com/auth/calendar.readonly' end,
    case when 'gmail'=any(p_enabled_services) then 'https://www.googleapis.com/auth/gmail.readonly' end
  ],null);
  if p_scopes is null or cardinality(p_scopes) <> cardinality(expected_scopes)
    or not p_scopes <@ expected_scopes or not p_scopes @> expected_scopes then raise exception 'INVALID_SCOPES'; end if;
  if char_length(coalesce(p_access_ciphertext,'')) not between 32 and 16384 then raise exception 'INVALID_CREDENTIAL'; end if;
  if char_length(coalesce(p_refresh_ciphertext,'')) not between 32 and 16384 then raise exception 'INVALID_CREDENTIAL'; end if;
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '2 hours' then raise exception 'INVALID_EXPIRY'; end if;

  insert into public.integrations(user_id,provider,status,account_email,scopes,enabled_services,connected_at,disconnected_at,updated_at)
  values(actor,'google','connected',p_email,p_scopes,p_enabled_services,now(),null,now())
  on conflict(user_id,provider) do update set
    status='connected', account_email=excluded.account_email, scopes=excluded.scopes,
    enabled_services=excluded.enabled_services, connected_at=now(), disconnected_at=null, updated_at=now()
  returning id into integration;

  insert into private.integration_credentials(integration_id,user_id,access_token_ciphertext,refresh_token_ciphertext,token_expires_at)
  values(integration,actor,p_access_ciphertext,p_refresh_ciphertext,p_expires_at)
  on conflict(integration_id) do update set
    user_id=excluded.user_id, access_token_ciphertext=excluded.access_token_ciphertext,
    refresh_token_ciphertext=excluded.refresh_token_ciphertext,
    token_expires_at=excluded.token_expires_at, updated_at=now();

  insert into public.integration_events(integration_id,user_id,action,detail)
  values(integration,actor,'connected',jsonb_build_object('scopes',p_scopes,'enabledServices',p_enabled_services));
  return integration;
end;
$$;

create function public.set_google_integration_service(p_service text,p_enabled boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); integration uuid; required_scope text;
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  if p_service not in ('calendar','gmail') then raise exception 'INVALID_SERVICE'; end if;
  if p_enabled is null then raise exception 'INVALID_ENABLED'; end if;
  required_scope := case p_service when 'calendar' then 'https://www.googleapis.com/auth/calendar.readonly' else 'https://www.googleapis.com/auth/gmail.readonly' end;
  select id into integration from public.integrations
    where user_id=actor and provider='google' and status='connected'
      and (not p_enabled or required_scope=any(scopes));
  if integration is null then return false; end if;
  update public.integrations set enabled_services = case when p_enabled then
    (select array_agg(distinct value order by value) from unnest(enabled_services || p_service) value)
    else array_remove(enabled_services,p_service) end, updated_at=now() where id=integration;
  insert into public.integration_events(integration_id,user_id,action,detail)
    values(integration,actor,case when p_enabled then 'service_enabled' else 'service_disabled' end,jsonb_build_object('service',p_service));
  return true;
end;
$$;

create or replace function public.get_google_integration_credential(p_user uuid) returns jsonb
language sql security definer set search_path='' stable as $$
  select jsonb_build_object(
    'integrationId',i.id,
    'accessTokenCiphertext',c.access_token_ciphertext,
    'refreshTokenCiphertext',c.refresh_token_ciphertext,
    'expiresAt',c.token_expires_at,
    'enabledServices',i.enabled_services
  )
  from public.integrations i
  join private.integration_credentials c on c.integration_id=i.id and c.user_id=i.user_id
  where i.user_id=p_user and i.provider='google' and i.status='connected'
$$;

revoke all on function public.save_google_integration(text,text[],text[],text,text,timestamptz),
  public.set_google_integration_service(text,boolean) from public,anon,authenticated;
grant execute on function public.save_google_integration(text,text[],text[],text,text,timestamptz),
  public.set_google_integration_service(text,boolean) to authenticated;
