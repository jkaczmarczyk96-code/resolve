-- Durable checkpoints for the finite Phase 5 workflow, scoped through problem ownership.
create table public.workflow_runs (
  id uuid primary key,
  problem_id uuid not null references public.problems(id) on delete cascade,
  state text not null check (state in ('PENDING','INTAKE','PLAN','DECIDE','COMPLETED','FAILED','CANCELLED')),
  revision integer not null default 0 check (revision between 0 and 4),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (snapshot ?& array['id','problemId','state','revision','version']),
  check (jsonb_typeof(snapshot->'id') = 'string' and jsonb_typeof(snapshot->'problemId') = 'string'
    and jsonb_typeof(snapshot->'state') = 'string' and jsonb_typeof(snapshot->'revision') = 'number'
    and jsonb_typeof(snapshot->'version') = 'number'),
  check (snapshot->>'id' = id::text and snapshot->>'problemId' = problem_id::text),
  check (snapshot->>'state' = state and snapshot->>'revision' = revision::text and snapshot->>'version' = '1'),
  check (octet_length(snapshot::text) <= 512000)
);
create index workflow_runs_problem_created_idx on public.workflow_runs(problem_id, created_at desc);

create function public.guard_basic_workflow_transition() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    if new.state <> 'PENDING' or new.revision <> 0 then
      raise exception 'Workflow must begin pending';
    end if;
  else
    if new.id <> old.id or new.problem_id <> old.problem_id or new.created_at <> old.created_at then
      raise exception 'Workflow identity is immutable';
    end if;
    if new.revision <> old.revision + 1 or not (
      (old.state = 'PENDING' and new.state in ('INTAKE','FAILED','CANCELLED')) or
      (old.state = 'INTAKE' and new.state in ('PLAN','FAILED','CANCELLED')) or
      (old.state = 'PLAN' and new.state in ('DECIDE','FAILED','CANCELLED')) or
      (old.state = 'DECIDE' and new.state in ('COMPLETED','FAILED','CANCELLED'))
    ) then
      raise exception 'Invalid workflow transition';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger workflow_runs_transition before insert or update on public.workflow_runs
for each row execute function public.guard_basic_workflow_transition();
revoke all on function public.guard_basic_workflow_transition() from public, anon, authenticated;

alter table public.workflow_runs enable row level security;
create policy workflow_runs_select on public.workflow_runs for select to authenticated
using (exists (select 1 from public.problems p where p.id = problem_id and p.user_id = (select auth.uid())));
create policy workflow_runs_insert on public.workflow_runs for insert to authenticated
with check (exists (select 1 from public.problems p where p.id = problem_id and p.user_id = (select auth.uid())));
create policy workflow_runs_update on public.workflow_runs for update to authenticated
using (exists (select 1 from public.problems p where p.id = problem_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.problems p where p.id = problem_id and p.user_id = (select auth.uid())));
create policy workflow_runs_delete on public.workflow_runs for delete to authenticated
using (exists (select 1 from public.problems p where p.id = problem_id and p.user_id = (select auth.uid())));
revoke all on public.workflow_runs from public, anon, authenticated;
grant select, insert, update, delete on public.workflow_runs to authenticated;
comment on table public.workflow_runs is 'Validated public agent outputs and durable checkpoints. No private reasoning. Owner-editable records are never execution authority.';
