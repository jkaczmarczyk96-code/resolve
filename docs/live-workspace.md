# Phase 7 — Live workspace

Phase 8 adds a persistent clarification pause and same-run continuation; see [human-input.md](human-input.md). The finite execution and retry boundaries below still apply to failures.

The default dashboard and problem list read owned Supabase records. A submission saves its description, reserves a web job, and starts the full eight-agent workflow. Each completed stage is saved before the next paid call. The workspace shows actual saved stages, event activity, plan, retrieved sources, evidence assessments, options, critique, decision rationale and proposed tasks. Progress counts saved agent outputs, not elapsed time or terminal revision numbers.

The UI polls every two seconds while active (ten seconds in a hidden tab). Reloading or leaving a page does not create another run. Read failures keep previously loaded data and offer Refresh. Read polling never starts work. Demo examples remain behind `?demo=1` or `demo-`/`draft-` IDs and display their temporary-data banner.

## Reservation and authorization

`web_runs` reserves one active job per authenticated user, at most five attempts in a rolling 24 hours, and three attempts per problem. An advisory transaction lock serializes reservations for an account. Request UUIDs are idempotent and bound to the original problem/description. Completed problems cannot be retried. Deleting a problem retains its quota record with a null foreign key.

Clients can read only non-secret job columns. RLS restricts reads to the owner; direct writes are revoked. SECURITY DEFINER RPCs independently verify `auth.uid()`. Claim/finish require an opaque HMAC derived server-side from the Nebius key, user ID and request ID; browser requests never receive it. Claim atomically changes queued to running once, so duplicate HTTP requests may register callbacks but cannot trigger duplicate agent chains. An owner can reserve a synthetic job through RPC but cannot use it to trigger the application's paid worker or claim a genuine application job without its secret.

POST handlers validate same-origin JSON and a 60,000-byte streaming limit; descriptions are 20–12,000 characters. Provider configuration is checked before reserving. No service-role client is used. The detached worker carries the verified user's access token, refreshed before the response when close to expiry; all persistence remains subject to RLS. Errors return sanitized codes and private/no-store headers.

## Execution and retry limits

Node execution uses Next.js [`after`](https://nextjs.org/docs/app/api-reference/functions/after) following the accepted response, with `maxDuration = 300`. Hosting must support this duration; this phase is verified with a local production Node server and does not deploy a hosting worker. Agent/search/network limits from Phase 6 still apply. Work is bounded to 240 seconds from POST entry (including request setup), with 60 seconds reserved within the hosting limit for cancellation and final status updates and checks its deadline before provider calls and writes. The reservation expires after 20 minutes; expired workers cannot claim or finish a job.

This is a finite in-process run, not a crash-resumable queue. Process termination may leave a job interrupted until lease expiry. The UI then allows explicit retry, starting the whole chain with a new run ID; old snapshots remain stored until the problem is deleted, while the workspace displays the latest attempt. There is no automatic paid retry. Missing finish acknowledgements are handled conservatively through lease expiry. Rotating the Nebius key can prevent idempotent recovery of a previous queued reservation; let its lease expire before retrying.

Research investigates up to three priority questions in new runs and records incomplete plan coverage. Confidence and model evidence assessments retain the documented conservative limits. Tasks are proposals; no task is executed. Answer collection and continuation are implemented in Phase 8; persistent monitoring is Phase 10.

## Verification

Offline SQL tests cover body binding, duplicate claims, hidden secrets, foreign-account access, direct mutation denial, active/daily/attempt limits, deletion-resistant quota and expired workers. HTTP tests cover origin, JSON, byte limits and sanitized errors. Worker tests cover successful completion, consumed claims and sanitized failures.

The live Chromium test creates a problem through the UI using real Supabase, Nebius and Tavily; repeats its submission; reloads; checks all saved stages; inspects result sections at desktop/mobile widths; verifies another account cannot access or retry it; then retries a locally seeded failed job through the real UI. It performs two full AI chains. Auth and demo regression tests remain available separately. Run `npm run test:e2e:live` only with the local services and both provider keys configured.
