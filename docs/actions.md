# External actions — phase 14

Phase 14 turns the existing Google reads into explicit read actions and adds the first bounded write action: creating an event in the user's primary Google Calendar. Avenli never converts generated tasks into external writes automatically. A completed problem is required before an event proposal can be prepared.

Preparing an event stores the exact title, description, location, start and end time in `external_actions` with status `proposed`. It does not call Google. The user sees those values again and must select **Review approval** followed by **Create event now**. The approval endpoint claims the action for that user and executes it synchronously. Proposals may be cancelled before execution; failed attempts retain the unchanged payload for review and a bounded retry.

Calendar reads continue to use `calendar.readonly`. Event creation uses the narrower incremental `calendar.events.owned` permission and is requested only from a prepared Calendar action. Calendar must remain independently enabled in Settings. The write request targets the primary calendar, never adds attendees and never sends invitations.

Each action UUID produces a deterministic Google event ID. A retry that receives Google's duplicate response reads that exact event and accepts it only when its private `avenliActionId` property matches the action UUID. This makes a provider or network retry idempotent without searching by user-visible event text.

`external_action_events` is the append-only owner-readable audit trail. Its identity sequence preserves a total order across `proposed`, `approved`, `execution_started`, `succeeded`, `failed` and `cancelled`. `external_actions` records the problem, integration, timestamps, attempt count, sanitized error code and bounded result. Provider credentials never enter either table. Row-level security permits users to read only their rows; owner-checking RPCs perform proposals, claims and cancellation, while only `service_role` may finalize provider results.

The API surface is:

- `POST /api/problems/:id/actions` prepares an idempotent proposal using a client request UUID.
- `POST /api/actions/:id/approve` requires the exact confirmation value `CREATE`, claims the action and invokes Google.
- `POST /api/actions/:id/cancel` cancels a proposal or failed attempt.

Every route requires an authenticated account, same-origin JSON and bounded validated fields. A user may keep at most ten open, executing or failed actions, each event must start in the future and may span at most seven days, and execution attempts stop after five. Account export includes action and audit records; account or problem deletion cascades them.

Verification covers database authorization and transitions, request validation, provider success and failure, missing scope handling, deterministic duplicate recovery, proposal/approval separation in the UI, generated database types and the complete application test/build suite. A live production event should use a clearly labeled disposable event and be removed manually after verification.
