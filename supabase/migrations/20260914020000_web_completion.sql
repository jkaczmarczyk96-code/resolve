-- Phase 15: durable onboarding state and privacy-preserving first-party product analytics.
alter table public.profiles add column onboarding_completed_at timestamptz;
alter table public.profiles add column product_analytics_enabled boolean not null default true;

create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in ('page_view','onboarding_completed','onboarding_skipped','problem_created','demo_opened','calendar_action_succeeded')),
  path text not null check (char_length(path) between 1 and 200 and path ~ '^/[A-Za-z0-9_./:-]*$'),
  properties jsonb not null default '{}' check (jsonb_typeof(properties)='object' and octet_length(properties::text)<=2048),
  occurred_at timestamptz not null default now()
);
create index product_events_user_occurred_idx on public.product_events(user_id,occurred_at desc);

alter table public.product_events enable row level security;
revoke all on public.product_events from public,anon,authenticated,service_role;
grant select on public.product_events to authenticated;
create policy product_events_select on public.product_events for select to authenticated
  using (user_id=(select auth.uid()));

create function public.record_product_event(p_event_name text,p_path text,p_properties jsonb default '{}') returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); created uuid;
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  if p_event_name not in ('page_view','onboarding_completed','onboarding_skipped','problem_created','demo_opened','calendar_action_succeeded') then raise exception 'INVALID_EVENT'; end if;
  if p_path is null or char_length(p_path) not between 1 and 200 or p_path !~ '^/[A-Za-z0-9_./:-]*$' then raise exception 'INVALID_PATH'; end if;
  if p_properties is null or jsonb_typeof(p_properties)<>'object' or octet_length(p_properties::text)>2048 then raise exception 'INVALID_PROPERTIES'; end if;
  if not coalesce((select product_analytics_enabled from public.profiles where id=actor),false) then return null; end if;
  if (select count(*) from public.product_events where user_id=actor and occurred_at>now()-interval '1 hour')>=120 then raise exception 'RATE_LIMIT'; end if;
  insert into public.product_events(user_id,event_name,path,properties) values(actor,p_event_name,p_path,p_properties) returning id into created;
  return created;
end;
$$;
revoke all on function public.record_product_event(text,text,jsonb) from public,anon;
grant execute on function public.record_product_event(text,text,jsonb) to authenticated;

-- Account exports include the user's product events. No cookies, auth URLs, search text or provider data are collected.
create or replace function public.export_account_data() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  return jsonb_build_object(
    'version',2,'exportedAt',now(),
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
    'product_events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.product_events t where user_id=actor)
  );
end;
$$;

