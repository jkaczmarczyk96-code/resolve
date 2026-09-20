# Phase 8 — Human input and continuation

The web workflow now asks for essential personal information before research. The planner separates public research questions from missing user constraints/preferences and may produce up to eight distinct user questions. If there are any, the same full workflow saves `ACTION_REQUIRED` after its initial plan; the worker publishes an immutable question/checkpoint record and releases its active slot. No Tavily call or downstream agent runs while waiting.

The workspace displays **Resolve needs your input**. Every question accepts a 1–1,200-character response, including an explicit admission of uncertainty. Answers are saved on submission, survive reload, and remain visible as user-reported context. Unsubmitted text is temporary. The original intake unknowns remain in the audit record; they are not silently relabeled as verified facts.

## Same-run continuation

`POST /api/problems/[id]/respond` accepts `{ requestId, runId, answers }`. It verifies the session, origin, owned problem/run, waiting checkpoint, response count and bounds. The database stores the answers and response UUID atomically, requeues the same run with a fresh 20-minute lease, and prevents another active analysis for that account. Repeating the same response UUID/body is idempotent; a changed response or a competing response UUID returns a conflict. Browser polling never resumes work.

The worker claims the job once and receives the protected original checkpoint and saved response. It saves `RESUME`, runs the planner with the original intake plus structured user responses, and continues from the updated `RESEARCH` state. Intake does not run again. Options, critic, decision and tasks receive the same response context; the researcher receives up to three revised priority questions. Existing eight-agent runs without user questions remain unchanged.

This phase permits **one clarification round per run**. A clarified run uses nine model calls in total (the planner runs twice), one bounded Tavily search, and at most 13 saved events. Remaining unknowns after the answers stay explicit and confidence remains conservative. A response saying “I do not know” is valid and does not establish a fact. Additional rounds, autonomous monitoring and recovery after process termination are not introduced here. Retry after failure still starts a fresh attempt, as in Phase 7.

## Persistence and authorization

Migration `20260911000000_human_input.sql` extends the existing v2 state/revision constraints compatibly and adds `human_requests`. It is an owner-readable RLS table; clients cannot insert, edit or delete its checkpoint/questions/answers directly. Its primary key is the web run ID, with indexed user/problem references. Problem deletion removes its question/response data while the original web quota record remains.

Only `pause_web_run` with the worker secret can publish a question checkpoint, and it must exactly match the saved full workflow row. `respond_web_run` requires verified ownership and the server-derived secret. Claim and finish retain the Phase 7 secret and lease checks. A duplicate response cannot create another worker claim. Waiting jobs do not occupy an active slot; submitting answers may return `ACTIVE_RUN` if another analysis is running. Continuation is part of the original quota-counted attempt, not a new attempt. Waiting itself has no timeout; execution leases restart on a valid response. Keep the signing key (currently derived from the Nebius key) stable for pending requests: changing it prevents their continuation until the original key is restored.

The protected question checkpoint is authoritative for continuation; editable foundation/checkpoint records are not used to replace it. Any incompatible concurrent checkpoint edit causes the guarded save to fail rather than silently replaying an AI stage. Requests and results are private/no-store, and responses never expose the worker secret.

## Verification

Offline tests cover pause-before-search, same-run continuation, response propagation to all planning agents, no duplicate intake, completed-run rejection, ambiguous writes, missing/mismatched responses, owner isolation, direct-write denial, active-slot contention, idempotency, changed replays and the complete SQL state transition sequence.

`tests/e2e/human-input.spec.ts` uses real local Supabase, Nebius and Tavily. It verifies questions after reload, foreign/anonymous response rejection, responsive input layout, persisted answers, identical run ID, a single resume and completed results. It adds one clarified analysis (nine model calls and up to three searches) to `npm run test:e2e:live`. No responses are sent to external messaging services and no proposed task is executed.

Verified on 2026-09-11: 206 offline tests passed; all 15 live browser scenarios passed across the final runs, including real clarification/resume, the original workflow/retry, auth and demo regression. One earlier original-workflow attempt returned `INVALID_OUTPUT` from the model and was correctly stopped; its subsequent live regression passed. A zero-source search was also checked to retain empty claims and low confidence. Lint, TypeScript, production build, SQL lint and git whitespace checks passed.
