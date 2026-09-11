-- Resolve Foundation. Apply through Supabase migrations, never through the browser.
create type public.problem_status as enum ('analyzing','planning','researching','verifying','evaluating','action_required','waiting','monitoring','solved','failed');
create type public.confidence_level as enum ('low','medium','high');
create type public.unknown_status as enum ('unresolved','researching','needs_user','resolved');
create type public.step_status as enum ('pending','running','completed','failed','skipped');
create type public.task_status as enum ('pending','in_progress','completed','cancelled');
create type public.priority_level as enum ('low','medium','high','critical');
create type public.agent_run_status as enum ('pending','running','completed','failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https?://'),
  timezone text not null default 'UTC',
  preferred_language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  original_input text not null check (char_length(trim(original_input)) between 1 and 20000),
  status public.problem_status not null default 'analyzing',
  goal text,
  summary text,
  progress smallint not null default 0 check (progress between 0 and 100),
  confidence public.confidence_level,
  current_priority text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  solved_at timestamptz,
  check ((status = 'solved') = (solved_at is not null))
);
create index problems_user_created_idx on public.problems(user_id, created_at desc);

create table public.constraints (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  type text not null,
  description text not null check (char_length(trim(description)) > 0),
  value jsonb,
  is_hard_constraint boolean not null default true,
  source text not null default 'user',
  created_at timestamptz not null default now()
);

create table public.unknowns (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  description text not null check (char_length(trim(description)) > 0),
  importance public.priority_level not null default 'medium',
  status public.unknown_status not null default 'unresolved',
  resolution text,
  confidence public.confidence_level,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((status = 'resolved') = (resolved_at is not null)),
  check (status <> 'resolved' or nullif(trim(resolution), '') is not null)
);

create table public.plan_steps (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  status public.step_status not null default 'pending',
  sequence integer not null check (sequence >= 0),
  assigned_agent text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (problem_id, id),
  unique (problem_id, sequence),
  check ((status = 'completed') = (completed_at is not null))
);

-- Normalized depends_on: composite FKs prevent links across problems, even for the same owner.
create table public.plan_step_dependencies (
  problem_id uuid not null references public.problems(id) on delete cascade,
  plan_step_id uuid not null,
  depends_on_id uuid not null,
  primary key (problem_id, plan_step_id, depends_on_id),
  foreign key (problem_id, plan_step_id) references public.plan_steps(problem_id, id) on delete cascade,
  foreign key (problem_id, depends_on_id) references public.plan_steps(problem_id, id) on delete cascade,
  check (plan_step_id <> depends_on_id)
);
create index plan_step_dependencies_target_idx on public.plan_step_dependencies(problem_id, depends_on_id);

create table public.research_items (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  plan_step_id uuid,
  title text not null,
  claim text not null,
  summary text,
  source_url text not null check (source_url ~ '^https?://'),
  source_name text not null,
  source_date timestamptz,
  confidence public.confidence_level not null default 'low',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (problem_id, plan_step_id) references public.plan_steps(problem_id, id) on delete set null (plan_step_id)
);
create index research_items_step_idx on public.research_items(problem_id, plan_step_id);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  title text not null,
  description text not null,
  advantages text[] not null default '{}',
  disadvantages text[] not null default '{}',
  estimated_cost numeric(14,2) check (estimated_cost >= 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  score numeric(5,2) check (score between 0 and 100),
  rejected boolean not null default false,
  rejection_reason text,
  created_at timestamptz not null default now(),
  check (not rejected or nullif(trim(rejection_reason), '') is not null),
  check ((estimated_cost is null) = (currency is null))
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  title text not null,
  decision text not null,
  reasoning text not null,
  confidence public.confidence_level not null default 'low',
  assumptions text[] not null default '{}',
  created_at timestamptz not null default now()
);
comment on column public.decisions.reasoning is 'User-facing rationale summary only. Never store hidden chain-of-thought.';

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  status public.task_status not null default 'pending',
  priority public.priority_level not null default 'medium',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'completed') = (completed_at is not null))
);

create table public.risks (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  title text not null,
  description text not null,
  severity public.priority_level not null default 'medium',
  probability numeric(4,3) check (probability between 0 and 1),
  mitigation text,
  created_at timestamptz not null default now()
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  agent_type text not null,
  status public.agent_run_status not null default 'pending',
  input jsonb not null default '{}',
  output jsonb,
  model text,
  tokens integer check (tokens >= 0),
  duration_ms integer check (duration_ms >= 0),
  error jsonb,
  created_at timestamptz not null default now()
);
comment on table public.agent_runs is 'Sanitized structured telemetry only. No secrets, raw provider payloads, or hidden reasoning.';

create function public.set_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger problems_updated_at before update on public.problems
  for each row execute function public.set_updated_at();

-- Explicit, operation-specific grants/policies. Anonymous callers receive no table privileges.
alter table public.profiles enable row level security;
alter table public.problems enable row level security;
revoke all on public.profiles, public.problems from public, anon, authenticated;
grant select, insert, update, delete on public.profiles, public.problems to authenticated;
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated using (id = (select auth.uid()));
create policy problems_select on public.problems for select to authenticated using (user_id = (select auth.uid()));
create policy problems_insert on public.problems for insert to authenticated with check (user_id = (select auth.uid()));
create policy problems_update on public.problems for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy problems_delete on public.problems for delete to authenticated using (user_id = (select auth.uid()));

do $$
declare
  child_table text;
  owner_check text := 'exists (select 1 from public.problems p where p.id = problem_id and p.user_id = (select auth.uid()))';
begin
  foreach child_table in array array['constraints','unknowns','plan_steps','plan_step_dependencies','research_items','options','decisions','tasks','risks','agent_runs']
  loop
    execute format('alter table public.%I enable row level security', child_table);
    execute format('revoke all on public.%I from public, anon, authenticated', child_table);
    execute format('grant select, insert, update, delete on public.%I to authenticated', child_table);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', child_table || '_select', child_table, owner_check);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', child_table || '_insert', child_table, owner_check);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', child_table || '_update', child_table, owner_check, owner_check);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', child_table || '_delete', child_table, owner_check);
    -- plan_steps/dependencies already have indexes starting with problem_id.
    if child_table not in ('plan_steps', 'plan_step_dependencies') then
      execute format('create index %I on public.%I(problem_id)', child_table || '_problem_idx', child_table);
    end if;
  end loop;
end;
$$;
