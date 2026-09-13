-- Fixed table allowlist and explicit exclusion of execution credentials.
create function public.export_account_data() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb; rows jsonb; table_name text;
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  result:=jsonb_build_object('version',1,'exportedAt',now(),
    'profile',(select to_jsonb(p) from public.profiles p where id=actor),
    'problems',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.problems p where user_id=actor),
    'web_runs',(select coalesce(jsonb_agg(to_jsonb(w)-'secret_token'),'[]'::jsonb) from public.web_runs w where user_id=actor));
  foreach table_name in array array['constraints','unknowns','plan_steps','plan_step_dependencies','research_items','options','decisions','tasks','risks','agent_runs','workflow_runs','full_workflow_runs'] loop
    execute pg_catalog.format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t where problem_id in (select id from public.problems where user_id=$1)',table_name) into rows using actor;
    result:=result||jsonb_build_object(table_name,rows);
  end loop;
  foreach table_name in array array['human_requests','monitoring_conditions','notifications','notification_events','notification_preferences'] loop
    execute pg_catalog.format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t where user_id=$1',table_name) into rows using actor;
    result:=result||jsonb_build_object(table_name,rows);
  end loop;
  return result;
end;
$$;
revoke all on function public.export_account_data() from public,anon;
grant execute on function public.export_account_data() to authenticated;
