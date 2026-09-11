-- Public web submissions are reserved atomically; owners cannot rewrite quota or worker state.
create table public.web_runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id uuid references public.problems(id) on delete set null,
  status text not null check (status in ('queued','running','completed','failed')),
  secret_token text not null check (secret_token ~ '^[a-f0-9]{64}$'),
  error text check (error is null or error in ('PROVIDER','TIMEOUT','INTERRUPTED','CONFIGURATION','INVALID_INPUT','INVALID_OUTPUT','AUTHENTICATION','RATE_LIMIT','REFUSED','TRUNCATED','CANCELLED','PERSISTENCE')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '20 minutes')
);
create index web_runs_user_created_idx on public.web_runs(user_id, created_at desc);
create index web_runs_problem_created_idx on public.web_runs(problem_id, created_at desc);
alter table public.web_runs enable row level security;
revoke all on public.web_runs from public, anon, authenticated;
grant select(id,user_id,problem_id,status,error,created_at,expires_at) on public.web_runs to authenticated;
create policy web_runs_select on public.web_runs for select to authenticated using (user_id = (select auth.uid()));

create function public.reserve_web_run(p_request_id uuid, p_secret text, p_problem_id uuid default null, p_description text default null)
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
    if (select count(*) from public.web_runs where user_id = actor and problem_id = target) >= 3 then raise exception 'ATTEMPT_LIMIT'; end if;
    if exists (select 1 from public.web_runs where problem_id = target and status = 'completed') then raise exception 'ALREADY_COMPLETED'; end if;
  else
    insert into public.problems(user_id,title,original_input,status) values (actor,left(trim(p_description),100),trim(p_description),'analyzing') returning id into target;
  end if;
  insert into public.web_runs(id,user_id,problem_id,status,secret_token) values (p_request_id,actor,target,'queued',p_secret) returning * into job;
  return jsonb_build_object('id',job.id,'problemId',job.problem_id,'status',job.status,'error',job.error,'expiresAt',job.expires_at);
end;
$$;

create function public.claim_web_run(p_run_id uuid, p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job public.web_runs;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  update public.web_runs set status = 'running'
    where id = p_run_id and user_id = auth.uid() and secret_token = p_secret and status = 'queued' and expires_at > now() and problem_id is not null
    returning * into job;
  if not found then return null; end if;
  return jsonb_build_object('id',job.id,'problemId',job.problem_id,'status',job.status,'error',job.error,'expiresAt',job.expires_at);
end;
$$;

create function public.finish_web_run(p_run_id uuid, p_secret text, p_status text, p_error text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION'; end if;
  if p_status not in ('completed','failed') or p_status is null then raise exception 'INVALID_INPUT'; end if;
  update public.web_runs set status = p_status, error = case when p_status = 'completed' then null else coalesce(p_error,'PROVIDER') end
    where id = p_run_id and user_id = auth.uid() and secret_token = p_secret and status = 'running' and expires_at > now();
  return found;
end;
$$;
revoke all on function public.reserve_web_run(uuid,text,uuid,text), public.claim_web_run(uuid,text), public.finish_web_run(uuid,text,text,text) from public, anon;
grant execute on function public.reserve_web_run(uuid,text,uuid,text), public.claim_web_run(uuid,text), public.finish_web_run(uuid,text,text,text) to authenticated;
