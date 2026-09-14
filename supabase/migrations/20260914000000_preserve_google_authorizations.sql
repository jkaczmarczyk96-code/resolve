-- Provider grants and locally enabled services have separate lifecycles. A user
-- may keep a previously authorized scope while disabling that service in Avenli.
create or replace function public.save_google_integration(
  p_email text,
  p_scopes text[],
  p_enabled_services text[],
  p_access_ciphertext text,
  p_refresh_ciphertext text,
  p_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); integration uuid;
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  if p_email is null or char_length(p_email) not between 3 and 320 or position('@' in p_email) < 2 then raise exception 'INVALID_EMAIL'; end if;
  if p_scopes is null or cardinality(p_scopes) not between 1 and 2
    or array_position(p_scopes,null) is not null
    or not p_scopes <@ array[
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/gmail.readonly'
    ]::text[]
    or (cardinality(p_scopes)=2 and p_scopes[1]=p_scopes[2])
    then raise exception 'INVALID_SCOPES'; end if;
  if p_enabled_services is null or cardinality(p_enabled_services) not between 1 and 2
    or array_position(p_enabled_services,null) is not null
    or not p_enabled_services <@ array['calendar','gmail']::text[]
    or (cardinality(p_enabled_services)=2 and p_enabled_services[1]=p_enabled_services[2])
    then raise exception 'INVALID_SERVICES'; end if;
  if ('calendar'=any(p_enabled_services) and not 'https://www.googleapis.com/auth/calendar.readonly'=any(p_scopes))
    or ('gmail'=any(p_enabled_services) and not 'https://www.googleapis.com/auth/gmail.readonly'=any(p_scopes))
    then raise exception 'INVALID_SCOPES'; end if;
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
