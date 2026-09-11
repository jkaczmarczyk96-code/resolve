-- Separate v2 snapshots preserve existing basic workflow contracts and records.
create table public.full_workflow_runs (
  id uuid primary key,
  problem_id uuid not null references public.problems(id) on delete cascade,
  state text not null check (state in ('PENDING','INTAKE','PLAN','RESEARCH','VERIFY','OPTIONS','CRITIQUE','DECIDE','TASKS','COMPLETED','FAILED','CANCELLED')),
  revision integer not null default 0 check (revision between 0 and 9),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (snapshot ?& array['id','problemId','state','revision','version']),
  check (jsonb_typeof(snapshot->'id') = 'string' and jsonb_typeof(snapshot->'problemId') = 'string'
    and jsonb_typeof(snapshot->'state') = 'string' and jsonb_typeof(snapshot->'revision') = 'number' and jsonb_typeof(snapshot->'version') = 'number'),
  check (snapshot->>'id' = id::text and snapshot->>'problemId' = problem_id::text),
  check (snapshot->>'state' = state and snapshot->>'revision' = revision::text and snapshot->>'version' = '2'),
  check (octet_length(snapshot::text) <= 512000)
);
create index full_workflow_runs_problem_created_idx on public.full_workflow_runs(problem_id, created_at desc);
create function public.guard_full_workflow_transition() returns trigger
language plpgsql set search_path = '' as $$
declare
  sequence text[] := array['PENDING','INTAKE','PLAN','RESEARCH','VERIFY','OPTIONS','CRITIQUE','DECIDE','TASKS','COMPLETED'];
  old_index integer;
begin
  if TG_OP = 'INSERT' then
    if new.state <> 'PENDING' or new.revision <> 0 then raise exception 'Workflow must begin pending'; end if;
  else
    if new.id <> old.id or new.problem_id <> old.problem_id or new.created_at <> old.created_at then raise exception 'Workflow identity is immutable'; end if;
    old_index := array_position(sequence, old.state);
    if old_index is null or old_index >= 10 or new.revision <> old.revision + 1 or not (new.state in ('FAILED','CANCELLED') or new.state = sequence[old_index + 1]) then
      raise exception 'Invalid workflow transition';
    end if;
  end if;
  new.updated_at = now(); return new;
end;
$$;
revoke all on function public.guard_full_workflow_transition() from public, anon, authenticated;
create trigger full_workflow_runs_transition before insert or update on public.full_workflow_runs
for each row execute function public.guard_full_workflow_transition();
alter table public.full_workflow_runs enable row level security;
revoke all on public.full_workflow_runs from public, anon, authenticated;
grant select, insert, update, delete on public.full_workflow_runs to authenticated;
create policy full_workflow_runs_select on public.full_workflow_runs for select to authenticated
using (exists (select 1 from public.problems p where p.id = problem_id and p.user_id = (select auth.uid())));
create policy full_workflow_runs_insert on public.full_workflow_runs for insert to authenticated
with check (exists (select 1 from public.problems p where p.id = problem_id and p.user_id = (select auth.uid())));
create policy full_workflow_runs_update on public.full_workflow_runs for update to authenticated
using (exists (select 1 from public.problems p where p.id = problem_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.problems p where p.id = problem_id and p.user_id = (select auth.uid())));
create policy full_workflow_runs_delete on public.full_workflow_runs for delete to authenticated
using (exists (select 1 from public.problems p where p.id = problem_id and p.user_id = (select auth.uid())));
comment on table public.full_workflow_runs is 'Full workflow public outputs, search excerpts and proposed tasks. Owner-scoped data, never execution authority.';
