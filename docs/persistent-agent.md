# Persistent execution and monitoring

Phase 10 lets an interrupted analysis continue from its latest validated checkpoint and lets a user keep a completed problem open while a factual condition is checked over time.

## Workflow recovery

Every successful agent stage is stored in `full_workflow_runs`. A timeout or cancellation now returns the web job to `queued` while keeping that snapshot. Loading the problem claims the queued job and resumes at the next unfinished stage. A process that disappears without yielding leaves a `running` lease; after expiry, the same problem GET can recover it.

Recovery keeps the original run ID and does not consume the three-attempt quota. It can renew a run at most three times. Claiming and recovery use owner-bound secrets, row locks and a per-user transaction advisory lock. Terminal, invalid and human-input checkpoints cannot be recovered through this path. Provider calls have at-least-once semantics across a process crash: a call whose response was never checkpointed may run again.

## Monitoring conditions

After one analysis completes, the user can save a concrete condition and a self-contained search query. Up to five conditions may be active per account. Conditions can be paused and resumed; failed checks remain visible and can be resumed manually.

Vercel invokes `/api/cron/monitor` once daily. The server claims at most two due conditions with `FOR UPDATE SKIP LOCKED` and a four-minute lease, searches with Tavily, and asks Nebius to classify the condition as `met`, `not_met`, or `uncertain`. `met` requires direct current evidence. Saved results contain the public summary and selected source metadata; retrieved excerpts are not stored in the monitoring table. A met condition changes the problem to `action_required` for user review. Inconclusive checks return to the daily queue.

The cron endpoint requires `CRON_SECRET`. Database worker functions are executable only by Supabase `service_role`, and the application reads that credential from server-only `SUPABASE_SECRET_KEY`. Browser clients can read only their own rows through RLS and mutate conditions only through owner-checking RPCs.

Monitoring does not execute tasks, purchases, bookings, messages or account changes. Phase 11 will add notifications; until then, users see monitoring results when they open the problem.

Apply `20260912000000_persistent_agent.sql`, set `SUPABASE_SECRET_KEY` and `CRON_SECRET` in the production environment, and keep both values out of browser-prefixed variables and source control.
