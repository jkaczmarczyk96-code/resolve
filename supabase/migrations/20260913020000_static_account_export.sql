-- Static queries also allow hosted plpgsql_check to validate each relation.
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
    'notification_preferences',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.notification_preferences t where user_id=actor)
  );
end;
$$;

