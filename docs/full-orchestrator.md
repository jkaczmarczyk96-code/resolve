# Phase 6 — Full Orchestrator

This documents the original finite chain. Phase 7 connects it to the web; Phase 8 adds optional `ACTION_REQUIRED → RESUME → RESEARCH` continuation with structured user responses and a replanning call. See [human-input.md](human-input.md) for the compatible extended v2 contract.

The internal server function `runFullWorkflow` runs the finite chain Intake → Plan → Research → Verify → Options → Critique → Decide → Tasks. It makes at most eight model requests and three search requests, with no retries or autonomous loop. The original basic workflow remains supported. Web integration is Phase 7 and is not enabled by this phase.

## New stages

Options proposes distinct approaches from the problem, plan, evidence, and verification. It may return no viable candidates. Task generation consumes the selected decision and proposes up to twenty tasks with validated plan/option references and an acyclic dependency graph. Every task has status `proposed`; there is no execution, external action, completion claim, or approval implied. An abstaining decision cannot produce tasks attached to an unselected option.

Both stages use the same typed input/output validation, system/data separation, provider abstraction, timeout, and safe error codes as the earlier agents. The existing agent registry now includes `options` and `tasks` alongside the original six.

## Research and confidence limits

The workflow investigates up to three distinct research questions, ordered by plan-step priority and then by the planner's order. If no step has a question, the structured goal is used. Tavily searches run concurrently within the existing research-stage timeout. Results are deduplicated across queries by canonical URL, re-keyed into one evidence set and capped at ten sources with bounded excerpts. The exact researched questions, returned sources and analysis are persisted together. Other questions remain in the stored plan and the decision receives an explicit coverage limitation. Tavily retrieval and model analysis remain separate. Missing search configuration fails before any paid agent call; any failed search stops the chain. Empty results are valid, but cannot support fabricated claims.

Verifier consumes the exact research claims and merged sources. Options and Critic consume the actual verification result. Decision receives the real options, critique, evidence and original plan, plus an explicit reminder whenever the bounded run did not cover every planned question. No missing agent result is replaced with a fake success.

Persisted confidence is capped conservatively: Low for unresolved assumptions/unknowns, objections, research/option limitations, unprocessed research questions, absent or non-verified evidence, abstention, or fewer than two supporting source hostnames. Otherwise it is at most Medium and never higher than the model rating. Distinct hostnames do not prove source independence, and model verification is not a guarantee of truth. More detailed evidence quality, freshness and conflict handling remains Phase 9. No percentage is invented.

## Persistence and access

`full_workflow_runs` stores version 2 snapshots separately from the basic version 1 table. This preserves existing runs and their transition rules. The shared authenticated Supabase adapter exposes `createFullWorkflowStore` and retains `createWorkflowStore` for basic runs. It verifies identity with `getUser()`, reads the original problem under ownership checks, and uses RLS for every database operation.

```text
PENDING(0) → INTAKE(1) → PLAN(2) → RESEARCH(3) → VERIFY(4)
→ OPTIONS(5) → CRITIQUE(6) → DECIDE(7) → TASKS(8) → COMPLETED(9)
```

Each checkpoint stores all previously validated results. Active states can transition to FAILED or CANCELLED; terminal states are immutable. Before starting the next agent the new checkpoint must be saved successfully. Stable run IDs prevent duplicate submissions while records exist, revision comparison rejects stale writers, and the database trigger prohibits skipped states and identity changes. Other users cannot read or mutate a run. Deleting the problem cascades its snapshots.

Snapshots are size-bounded and validated again on read, including source, decision and task references. They contain public structured outputs and retrieved excerpts, never provider reasoning fields or API keys. Owner-editable data is not execution authority. Normalized problem/task tables and the web demo are not updated; proposed tasks are durable inside the run snapshot.

As in the basic workflow, ambiguous database writes stop further work. Agent errors preserve earlier durable results in a terminal checkpoint. There is no automatic crash recovery, background worker, human-answer collection, or resume yet. A crashed process can leave a readable active checkpoint. COMPLETED means the analysis finished, not that a real-world goal was achieved.

## Usage and checks

```typescript
const store = await createFullWorkflowStore(await createClient());
const result = await runFullWorkflow(
  { runId, problemId }, // Keep runId stable for duplicate submissions.
  store,
  { ai: createNebiusProvider(), research: createTavilyProvider() },
);
```

The functions are in `src/lib/orchestration/full.ts` and `supabase-store.ts`; provider factories are in `src/lib/ai/nebius.ts` and `research.ts`. Future public entry points must add submission quotas and retry/resume authorization before exposing them to users.

```powershell
npx supabase migration up --local
npm run db:types
npm test
npm run lint
npm run typecheck
npm run build
npx supabase db lint --local --level warning
# Opt-in: eight real model requests plus up to three real Tavily searches.
npm run test:full:live
```

The live test requires the Resolve local Supabase/Mailpit stack and server-only `NEBIUS_API_KEY`/`TAVILY_API_KEY` in `.env.local`. It uses a public documentation question, checks all eight stages, reloads the final checkpoint from a fresh client, checks cross-user access for all CRUD operations, and removes the test problem. Offline tests cover every agent failure and every ambiguous checkpoint write, empty evidence, abstention, duplicate IDs, cancellation, timeouts, task cycles, foreign references, version separation, SQL transitions, and cascade cleanup.

Verified on 2026-09-10: 185 offline tests passed; the complete live eight-agent workflow passed with real Nebius/NVIDIA, Tavily retrieval and local Supabase, including fresh-client reads and two-user isolation. The original basic durable live workflow also passed after the shared-store refactor. Lint, TypeScript, production build and local PostgreSQL schema lint passed. Both workflow migrations remain applied.

Phase 7 will connect this workflow to the workspace. It requires a separate instruction.
