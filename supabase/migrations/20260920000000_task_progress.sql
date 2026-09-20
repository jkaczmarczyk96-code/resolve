-- Persist generated task progress independently from immutable workflow snapshots.
alter table public.full_workflow_runs
  add constraint full_workflow_runs_problem_id_id_key unique (problem_id, id);

alter table public.tasks
  add column workflow_run_id uuid,
  add column source_task_id text,
  add constraint tasks_generated_identity_check check (
    (workflow_run_id is null and source_task_id is null)
    or (workflow_run_id is not null and source_task_id ~ '^[a-zA-Z0-9_-]{1,80}$')
  ),
  add constraint tasks_workflow_run_fkey foreign key (problem_id, workflow_run_id)
    references public.full_workflow_runs(problem_id, id) on delete cascade,
  add constraint tasks_generated_identity_key unique (problem_id, workflow_run_id, source_task_id);

create index tasks_problem_status_idx on public.tasks(problem_id, status);

-- Existing completed analyses become actionable as soon as this migration lands.
insert into public.tasks(problem_id, workflow_run_id, source_task_id, title, description, priority)
select run.problem_id, run.id, item->>'id', item->>'title', item->>'description', (item->>'priority')::public.priority_level
from public.full_workflow_runs run
cross join lateral jsonb_array_elements(case when jsonb_typeof(run.snapshot #> '{tasks,tasks}') = 'array' then run.snapshot #> '{tasks,tasks}' else '[]'::jsonb end) item
where run.state = 'COMPLETED'
on conflict (problem_id, workflow_run_id, source_task_id) do nothing;

-- Completing a web run and materializing its generated tasks is one transaction.
create or replace function public.finish_web_run(p_run_id uuid, p_secret text, p_status text, p_error text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  job public.web_runs;
  generated jsonb;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  if p_status not in ('completed','failed') or p_status is null then raise exception 'INVALID_INPUT'; end if;

  update public.web_runs
    set status = p_status,
        error = case when p_status = 'completed' then null else coalesce(p_error,'PROVIDER') end
    where id = p_run_id
      and user_id = auth.uid()
      and secret_token = p_secret
      and status = 'running'
      and expires_at > now()
    returning * into job;
  if not found then return false; end if;

  if p_status = 'completed' then
    select snapshot #> '{tasks,tasks}' into generated
    from public.full_workflow_runs
    where id = p_run_id and problem_id = job.problem_id and state = 'COMPLETED';
    if jsonb_typeof(generated) <> 'array' then raise exception 'INVALID_RESULT'; end if;

    insert into public.tasks(problem_id, workflow_run_id, source_task_id, title, description, priority)
    select job.problem_id, job.id, item->>'id', item->>'title', item->>'description', (item->>'priority')::public.priority_level
    from jsonb_array_elements(generated) item
    on conflict (problem_id, workflow_run_id, source_task_id) do nothing;
  end if;
  return true;
end;
$$;
revoke all on function public.finish_web_run(uuid,text,text,text) from public, anon;
grant execute on function public.finish_web_run(uuid,text,text,text) to authenticated;
