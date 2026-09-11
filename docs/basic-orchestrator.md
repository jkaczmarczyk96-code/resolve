# Phase 5 — Basic Orchestrator

The server-side `runBasicWorkflow` function executes exactly Intake → Plan → Decide. Each agent consumes validated output from the preceding stage. There is no autonomous loop, automatic retry, research call, option generation agent, critique agent, task execution, or public endpoint. Web integration remains Phase 7; the visible workspace still uses demo data.

## Durable state

The new `workflow_runs` table stores a versioned snapshot containing the original description, configured model, validated public outputs, state, revision, safe error code, and timestamped state events. The migration is `20260909020000_basic_workflows.sql`. No raw provider responses or private reasoning are stored.

The successful sequence is:

```text
PENDING (revision 0)
→ INTAKE (1)
→ PLAN (2, Intake output saved)
→ DECIDE (3, Plan output saved)
→ COMPLETED (4, Decision output saved)
```

Each active state can instead transition to FAILED or CANCELLED. The next agent is called only after the preceding checkpoint write succeeds. Database errors or ambiguous write acknowledgements stop the caller immediately; the orchestrator does not attempt another write or paid call. A provider failure saves a terminal checkpoint, retaining already-saved outputs. Duplicate run IDs are rejected before model invocation. Revision comparisons prevent stale writers, while a database trigger rejects skipped/backward transitions, identity changes, and writes after a terminal state.

The snapshots survive application restart and can be loaded from a fresh authenticated connection. A process crash can leave an active checkpoint; this phase does not automatically resume it or guarantee exactly-once provider execution across crashes. Resume, user answers, waiting, and monitoring belong to later phases. Caller-provided stable run IDs prevent accidental replay while their records exist; deleting a run removes that protection.

COMPLETED means the three-agent analysis finished. It does not mean the real-world problem is solved. The existing problem's status and other normalized tables are not changed in this phase.

## Decision boundary

The Decision input now accepts the actual `planningContext` (structured problem plus complete plan) and a nullable critique. In the basic workflow, the single candidate is the proposed plan itself. It is explicitly a course of investigation, not a verified offer or a set of fabricated alternatives. Sources, claims, and verification assessments are empty, and critique is null because those agents have not run.

The application caps the persisted confidence at Low because evidence is absent. A model's unsupported High rating is rejected by agent validation; Medium is reduced to Low. The model may select the proposed plan or abstain. Unknowns and user/research questions remain available in the stored Intake/Plan outputs. Collecting answers and resuming work are not implemented here.

## Internal usage

```typescript
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createNebiusProvider } from "@/lib/ai/nebius";
import { createWorkflowStore } from "@/lib/orchestration/supabase-store";
import { runBasicWorkflow } from "@/lib/orchestration/basic";

const store = await createWorkflowStore(await createClient());
const runId = randomUUID(); // Keep this ID stable when handling duplicate submissions.
const result = await runBasicWorkflow(
  { runId, problemId: existingOwnedProblemId },
  store,
  { ai: createNebiusProvider() },
);
const persisted = await store.load(runId);
```

The Supabase adapter verifies identity through `getUser()` and reads the original description from the owned problem, rather than trusting a caller-supplied description/owner. Every query uses the user-scoped client and RLS. Anonymous users cannot access the table; other users cannot read, create, update, or delete its checkpoints. The foreign key cascades problem deletion. Indexed ownership lookups and `(select auth.uid())` follow the existing database conventions.

Database/auth requests have ten-second deadlines. Each of the three model stages retains the Phase 4 agent/provider deadlines and output limits. Cancellation is propagated to agent calls and recorded when persistence is available. The workflow has no background worker or durable quota system yet. Future public callers must add submission quotas and define retry/resume authorization before exposing it through UI/API. Owner-editable stored outputs are data, never authority to execute actions.

## Verification

```powershell
npm run db:types
npm test
npm run lint
npm run typecheck
npm run build
npx supabase migration up --local
# Requires this project's local Supabase/Mailpit and the Nebius key in .env.local.
# Makes six paid model calls: isolated chain + durable integration, with fictional inputs.
npm run test:workflow:live
# Isolate model behavior while Docker is unavailable:
npm run test:workflow:live -- -t model-only
```

Offline tests cover data handoff, checkpoint order, sanitized model errors, malformed outputs, timeouts, cancellation, duplicate IDs, ambiguous writes, and malformed stored snapshots. PostgreSQL tests enforce RLS for every operation, anonymous denial, identity constraints, valid transitions, stale revision handling, terminal immutability, and cascade cleanup. Live tests separately verify the real model chain with a test-only memory store and the durable integration. The latter signs up a disposable local user, confirms it through local Mailpit, runs the real three-model flow against Supabase, reads the final snapshot through a fresh authenticated connection, and removes the test problem.

Verified on 2026-09-10: 149 offline tests passed, both live workflow cases passed (run separately), and lint, TypeScript checking, production build, and local Supabase schema lint passed. The new migration is applied to the Resolve local database. The durable live case confirmed that a fresh authenticated client reads the same completed checkpoint.

Phase 6 expands the agent chain. It requires a separate instruction.
