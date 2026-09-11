-- Extend v2 checkpoints compatibly; historical finite runs retain their original sequence.
alter table public.full_workflow_runs drop constraint full_workflow_runs_state_check;
alter table public.full_workflow_runs add constraint full_workflow_runs_state_check check (state in ('PENDING','INTAKE','PLAN','RESEARCH','ACTION_REQUIRED','RESUME','VERIFY','OPTIONS','CRITIQUE','DECIDE','TASKS','COMPLETED','FAILED','CANCELLED'));
alter table public.full_workflow_runs drop constraint full_workflow_runs_revision_check;
alter table public.full_workflow_runs add constraint full_workflow_runs_revision_check check (revision between 0 and 12);
create or replace function public.guard_full_workflow_transition() returns trigger
language plpgsql set search_path = '' as $$
declare sequence text[] := array['PENDING','INTAKE','PLAN','RESEARCH','VERIFY','OPTIONS','CRITIQUE','DECIDE','TASKS','COMPLETED']; allowed boolean;
begin
  if TG_OP = 'INSERT' then
    if new.state <> 'PENDING' or new.revision <> 0 then raise exception 'Workflow must begin pending'; end if;
  else
    if new.id <> old.id or new.problem_id <> old.problem_id or new.created_at <> old.created_at then raise exception 'Workflow identity is immutable'; end if;
    allowed := new.state in ('FAILED','CANCELLED') or new.state = sequence[array_position(sequence,old.state)+1]
      or (old.state='RESEARCH' and new.state='ACTION_REQUIRED' and not (old.snapshot ? 'human'))
      or (old.state='ACTION_REQUIRED' and new.state='RESUME') or (old.state='RESUME' and new.state='RESEARCH');
    if old.state in ('COMPLETED','FAILED','CANCELLED') or new.revision <> old.revision+1 or not coalesce(allowed,false) then raise exception 'Invalid workflow transition'; end if;
  end if;
  new.updated_at := now(); return new;
end;
$$;
alter table public.web_runs drop constraint web_runs_status_check;
alter table public.web_runs add constraint web_runs_status_check check (status in ('queued','running','action_required','completed','failed'));

create table public.human_requests (
  run_id uuid primary key references public.web_runs(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  checkpoint jsonb not null check (jsonb_typeof(checkpoint)='object' and octet_length(checkpoint::text)<=512000),
  questions jsonb not null check (jsonb_typeof(questions)='array' and jsonb_array_length(questions) between 1 and 8),
  response_id uuid unique,
  answers jsonb check (answers is null or (jsonb_typeof(answers)='array' and jsonb_array_length(answers)=jsonb_array_length(questions))),
  created_at timestamptz not null default now(), answered_at timestamptz,
  check ((answers is null)=(response_id is null) and (answers is null)=(answered_at is null))
);
create index human_requests_user_idx on public.human_requests(user_id);
create index human_requests_problem_idx on public.human_requests(problem_id);
alter table public.human_requests enable row level security;
revoke all on public.human_requests from public,anon,authenticated;
grant select on public.human_requests to authenticated;
create policy human_requests_select on public.human_requests for select to authenticated using (user_id=(select auth.uid()));

create function public.pause_web_run(p_run_id uuid,p_secret text,p_checkpoint jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare job public.web_runs;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  select * into job from public.web_runs where id=p_run_id and user_id=auth.uid() and secret_token=p_secret for update;
  if not found then return false; end if;
  if job.status='action_required' then return exists(select 1 from public.human_requests where run_id=job.id and checkpoint=p_checkpoint); end if;
  if job.status <> 'running' or job.expires_at <= now() or job.problem_id is null then return false; end if;
  if p_checkpoint->>'state' is distinct from 'ACTION_REQUIRED' or not exists (select 1 from public.full_workflow_runs where id=job.id and problem_id=job.problem_id and snapshot=p_checkpoint and state='ACTION_REQUIRED') then raise exception 'CONFLICT'; end if;
  insert into public.human_requests(run_id,problem_id,user_id,checkpoint,questions) values(job.id,job.problem_id,job.user_id,p_checkpoint,p_checkpoint->'human'->'questions');
  update public.web_runs set status='action_required',error=null where id=job.id;
  return true;
end;
$$;

create function public.respond_web_run(p_run_id uuid,p_problem_id uuid,p_secret text,p_response_id uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.web_runs; prompt public.human_requests;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  select * into job from public.web_runs where id=p_run_id and problem_id=p_problem_id and user_id=auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if job.secret_token <> p_secret or p_secret is null then raise exception 'CONFLICT'; end if;
  select * into prompt from public.human_requests where run_id=job.id;
  if not found then raise exception 'NOT_WAITING'; end if;
  if prompt.response_id is not null then
    if prompt.response_id is distinct from p_response_id or prompt.answers is distinct from p_answers then raise exception 'RESPONSE_CONFLICT'; end if;
  else
    if job.status <> 'action_required' then raise exception 'NOT_WAITING'; end if;
    if p_response_id is null or p_answers is null or jsonb_typeof(p_answers)<>'array' then raise exception 'INVALID_INPUT'; end if;
    if jsonb_array_length(p_answers)<>jsonb_array_length(prompt.questions) or exists(select 1 from jsonb_array_elements(p_answers) a where jsonb_typeof(a)<>'string' or char_length(trim(a#>>'{}')) not between 1 and 1200) then raise exception 'INVALID_INPUT'; end if;
    if not exists(select 1 from public.full_workflow_runs where id=job.id and snapshot=prompt.checkpoint) then raise exception 'CONFLICT'; end if;
    update public.web_runs set status='failed',error='INTERRUPTED' where user_id=auth.uid() and status in ('queued','running') and expires_at<=now();
    if exists(select 1 from public.web_runs where user_id=auth.uid() and status in ('queued','running')) then raise exception 'ACTIVE_RUN'; end if;
    update public.human_requests set response_id=p_response_id,answers=p_answers,answered_at=now() where run_id=job.id;
    update public.web_runs set status='queued',error=null,expires_at=now()+interval '20 minutes' where id=job.id returning * into job;
  end if;
  return jsonb_build_object('id',job.id,'problemId',job.problem_id,'status',job.status,'error',job.error,'expiresAt',job.expires_at);
end;
$$;

create or replace function public.claim_web_run(p_run_id uuid,p_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.web_runs; continuation jsonb;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  update public.web_runs set status='running' where id=p_run_id and user_id=auth.uid() and secret_token=p_secret and status='queued' and expires_at>now() and problem_id is not null returning * into job;
  if not found then return null; end if;
  select jsonb_build_object('checkpoint',checkpoint,'responseId',response_id,'answers',answers) into continuation from public.human_requests where run_id=job.id and response_id is not null;
  return jsonb_build_object('id',job.id,'problemId',job.problem_id,'status',job.status,'error',job.error,'expiresAt',job.expires_at,'resume',continuation);
end;
$$;
revoke all on function public.pause_web_run(uuid,text,jsonb),public.respond_web_run(uuid,uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.pause_web_run(uuid,text,jsonb),public.respond_web_run(uuid,uuid,text,uuid,jsonb) to authenticated;

create or replace function public.reserve_web_run(p_request_id uuid, p_secret text, p_problem_id uuid default null, p_description text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  job public.web_runs;
  target uuid;
begin
  if actor is null then raise exception 'AUTHENTICATION'; end if;
  if p_request_id is null or p_secret is null or p_secret !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_INPUT'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text, 0));
  select * into job from public.web_runs where id = p_request_id;
  if found then
    if job.user_id <> actor or job.secret_token <> p_secret then raise exception 'CONFLICT'; end if;
    if (p_problem_id is not null and job.problem_id is distinct from p_problem_id) or (p_problem_id is null and not exists (select 1 from public.problems where id = job.problem_id and original_input = trim(p_description))) then raise exception 'CONFLICT'; end if;
    return jsonb_build_object('id',job.id,'problemId',job.problem_id,'status',job.status,'error',job.error,'expiresAt',job.expires_at);
  end if;
  if p_problem_id is not null then
    select id into target from public.problems where id = p_problem_id and user_id = actor;
    if not found then raise exception 'NOT_FOUND'; end if;
  elsif p_description is null or char_length(trim(p_description)) not between 20 and 12000 then raise exception 'INVALID_INPUT';
  end if;
  update public.web_runs set status = 'failed', error = 'INTERRUPTED'
    where user_id = actor and status in ('queued','running') and expires_at <= now();
  if exists (select 1 from public.web_runs where user_id = actor and status in ('queued','running')) then raise exception 'ACTIVE_RUN'; end if;
  if (select count(*) from public.web_runs where user_id = actor and created_at > now() - interval '24 hours') >= 5 then raise exception 'DAILY_LIMIT'; end if;
  if target is not null then
    if exists (select 1 from public.web_runs where problem_id = target and status = 'action_required') then raise exception 'INPUT_REQUIRED'; end if;
    if (select count(*) from public.web_runs where user_id = actor and problem_id = target) >= 3 then raise exception 'ATTEMPT_LIMIT'; end if;
    if exists (select 1 from public.web_runs where problem_id = target and status = 'completed') then raise exception 'ALREADY_COMPLETED'; end if;
  else
    insert into public.problems(user_id,title,original_input,status) values (actor,left(trim(p_description),100),trim(p_description),'analyzing') returning id into target;
  end if;
  insert into public.web_runs(id,user_id,problem_id,status,secret_token) values (p_request_id,actor,target,'queued',p_secret) returning * into job;
  return jsonb_build_object('id',job.id,'problemId',job.problem_id,'status',job.status,'error',job.error,'expiresAt',job.expires_at);
end;
$$;
