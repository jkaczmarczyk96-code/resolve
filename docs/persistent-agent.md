# Persistent execution and monitoring

Phase 10 lets an interrupted analysis continue from its latest validated checkpoint and lets a user keep a completed problem open while a factual condition is checked over time.

## Workflow recovery

Every successful agent stage is stored in `full_workflow_runs`. A timeout or cancellation now returns the web job to `queued` while keeping that snapshot. Loading the problem claims the queued job and resumes at the next unfinished stage. A process that disappears without yielding leaves a `running` lease; after expiry, the same problem GET can recover it.

Recovery keeps the original run ID and does not consume the three-attempt quota. It can renew a run at most three times. Claiming and recovery use owner-bound secrets, row locks and a per-user transaction advisory lock. Terminal, invalid and human-input checkpoints cannot be recovered through this path. Provider calls have at-least-once semantics across a process crash: a call whose response was never checkpointed may run again.

## Monitoring conditions

After one analysis completes, the user can save a concrete condition and a self-contained search query. Up to five conditions may be active per account. Conditions can be paused and resumed; failed checks remain visible and can be resumed manually.

Vercel invokes `/api/cron/monitor` once daily. The server claims at most two due conditions with `FOR UPDATE SKIP LOCKED` and a four-minute lease, searches with Tavily, and asks Nebius to classify the condition as `met`, `not_met`, or `uncertain`. `met` requires direct current evidence. Saved results contain the public summary and selected source metadata; retrieved excerpts are not stored in the monitoring table. A met condition changes the problem to `action_required` for user review. Inconclusive checks return to the daily queue.

The cron endpoint requires `CRON_SECRET`. Database worker functions are executable only by Supabase `service_role`, and the application reads that credential from server-only `SUPABASE_SECRET_KEY`. Browser clients can read only their own rows through RLS and mutate conditions only through owner-checking RPCs.

Monitoring does not execute tasks, purchases, bookings, messages or account changes. Condition results and failures also appear in the owner-scoped in-app notification inbox.

## Saved action plan

When an analysis reaches `COMPLETED`, its validated generated tasks are materialized into the owner-scoped `tasks` table in the same transaction that completes the web run. Existing completed snapshots are backfilled by the task-progress migration. The immutable workflow snapshot remains the audit source for what the agent proposed; the task rows store only the user's later progress (`pending`, `in_progress`, `completed`, or `cancelled`) and the completion timestamp.

Changing a task status or due date never invokes an AI provider or an external integration. The task API validates the exact status and a future ISO timestamp, scopes the update to the requested problem and relies on problem-owner RLS. The dashboard counts active tasks due within seven days. The daily cron publishes at most one in-app reminder per task and saved deadline when that deadline is within 24 hours; changing the deadline creates a new reminder identity. Solved problems and completed or cancelled tasks are excluded. Calendar writes remain a separate proposal and explicit-approval flow.

## Problem lifecycle

The owner can mark a completed problem solved and later reopen it. Solving sets `problems.solved_at`, pauses active or claimed monitoring conditions, and appends an immutable owner-scoped lifecycle event. Reopening clears `solved_at`; monitoring stays paused until the owner resumes it explicitly. Both transitions are idempotent and included in the account export. A solved problem cannot create or resume monitoring through either the UI or the database functions.

Apply `20260912000000_persistent_agent.sql`, `20260920000000_task_progress.sql`, `20260920010000_problem_lifecycle.sql` and `20260920020000_task_deadlines.sql`, set `SUPABASE_SECRET_KEY` and `CRON_SECRET` in the production environment, and keep both values out of browser-prefixed variables and source control.
