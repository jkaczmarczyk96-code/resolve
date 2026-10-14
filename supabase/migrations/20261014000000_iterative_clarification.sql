-- Allow up to three persisted clarification rounds in one workflow run.
alter table public.full_workflow_runs drop constraint full_workflow_runs_revision_check;
alter table public.full_workflow_runs add constraint full_workflow_runs_revision_check check (revision between 0 and 18);

create or replace function public.guard_full_workflow_transition() returns trigger
language plpgsql set search_path = '' as $$
declare sequence text[] := array['PENDING','INTAKE','PLAN','RESEARCH','VERIFY','OPTIONS','CRITIQUE','DECIDE','TASKS','COMPLETED']; allowed boolean;
begin
  if TG_OP = 'INSERT' then
    if new.state <> 'PENDING' or new.revision <> 0 then raise exception 'Workflow must begin pending'; end if;
  else
    if new.id <> old.id or new.problem_id <> old.problem_id or new.created_at <> old.created_at then raise exception 'Workflow identity is immutable'; end if;
    allowed := new.state in ('FAILED','CANCELLED') or new.state = sequence[array_position(sequence,old.state)+1]
      or (old.state='RESEARCH' and new.state='ACTION_REQUIRED')
      or (old.state='ACTION_REQUIRED' and new.state='RESUME') or (old.state='RESUME' and new.state='RESEARCH');
    if old.state in ('COMPLETED','FAILED','CANCELLED') or new.revision <> old.revision+1 or not coalesce(allowed,false) then raise exception 'Invalid workflow transition'; end if;
  end if;
  new.updated_at := now(); return new;
end;
$$;

-- A previous round's response ID cannot be reused as an answer to new questions.
create or replace function public.respond_web_run(p_run_id uuid,p_problem_id uuid,p_secret text,p_response_id uuid,p_answers jsonb) returns jsonb
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
  if exists(select 1 from jsonb_array_elements(coalesce(prompt.checkpoint->'human'->'history','[]'::jsonb)) round
    where round->>'responseId'=p_response_id::text) then raise exception 'RESPONSE_CONFLICT'; end if;
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

create or replace function public.pause_web_run(p_run_id uuid,p_secret text,p_checkpoint jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare job public.web_runs; prompt public.human_requests;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  select * into job from public.web_runs where id=p_run_id and user_id=auth.uid() and secret_token=p_secret for update;
  if not found then return false; end if;
  if job.status='action_required' then return exists(select 1 from public.human_requests where run_id=job.id and checkpoint=p_checkpoint); end if;
  if job.status <> 'running' or job.expires_at <= now() or job.problem_id is null then return false; end if;
  if p_checkpoint->>'state' is distinct from 'ACTION_REQUIRED' or not exists (select 1 from public.full_workflow_runs where id=job.id and problem_id=job.problem_id and snapshot=p_checkpoint and state='ACTION_REQUIRED') then raise exception 'CONFLICT'; end if;
  select * into prompt from public.human_requests where run_id=job.id for update;
  if found then
    if prompt.response_id is null or prompt.checkpoint->>'revision' = p_checkpoint->>'revision' then raise exception 'CONFLICT'; end if;
    update public.human_requests set checkpoint=p_checkpoint,questions=p_checkpoint->'human'->'questions',response_id=null,answers=null,answered_at=null,created_at=now() where run_id=job.id;
  else
    insert into public.human_requests(run_id,problem_id,user_id,checkpoint,questions) values(job.id,job.problem_id,job.user_id,p_checkpoint,p_checkpoint->'human'->'questions');
  end if;
  update public.web_runs set status='action_required',error=null where id=job.id;
  return true;
end;
$$;
