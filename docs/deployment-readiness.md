# GitHub, hosted Supabase and Vercel

Current production: https://avenli.vercel.app. Source: private GitHub repository `jkaczmarczyk96-code/resolve`, branch `master`. Vercel Hobby and the dedicated Supabase Free project are connected. GitHub Actions run 34699219758 passed lint, TypeScript, all offline tests and production build for commit 77fd216. Local secrets and build/test outputs are ignored.

Hosted verification: landing/login/register pages return HTTP 200; an unauthenticated API request returns 401 and dashboard navigation redirects to login. The user confirmed successful signup and email confirmation on 2026-09-12. Recovery and the authenticated AI workflow still require hosted verification. Preview environments do not have production credentials; configure an isolated database before preview testing.

The user selected Vercel Hobby on 2026-09-11. Mutation routes declare `maxDuration=300`. Their worker budget is 240 seconds measured from the start of the request, leaving time for cancellation and a bounded status write. Provider calls receive the shared abort signal and no new paid calls or checkpoint writes start after the deadline. Phase 10 now yields timeout checkpoints for bounded recovery; see the current persistent-agent section below.

Access check on 2026-09-11: GitHub connector account is `jkaczmarczyk96-code`, with two unrelated repositories returned by the owner-affiliation list and no Resolve repository; no Git remote is configured. Supabase CLI sees only the unrelated `visa-assist` project, which must remain untouched. Vercel CLI authentication succeeded. On 2026-09-12, the separate Vercel project `resolve` was created under `jkaczmarczyk96-codes-projects` and linked locally (project ID `prj_Odh11f1mChXsiGz2mSJrLBmRnA59`). The repository now explicitly selects the Next.js framework in `vercel.json`. No deployment has been made and no database migrations have been applied remotely. Local validation of the Hobby adjustment: 214 offline tests, lint, TypeScript and production build passed; hosted behavior remains unverified.

Production configuration needs the hosted Supabase public URL/publishable key, trusted `SITE_URL`, and server-only Nebius/Tavily keys. Keep production and preview secrets and data separate. The current worker signing token is derived from the Nebius key; pending human requests require that key to remain stable. Local success does not prove hosted email or function lifecycle behavior.

References: [Vercel function limits](https://vercel.com/docs/functions/limitations), [Next after](https://nextjs.org/docs/app/api-reference/functions/after), and the project's [authentication guide](authentication.md).


## Hosted setup — 2026-09-12

Source is pushed to the private `jkaczmarczyk96-code/resolve` repository, branch `master`. Vercel Hobby is verified; the assigned domain is `resolve-nine.vercel.app`. Production environment configuration contains the hosted public Supabase URL/key, SITE_URL, and server-only Nebius/Tavily secrets. No deployment has been published.

The dedicated Free Supabase project `omdtlsmhxsudxqvoahfz` (`resolve`, Frankfurt) is created and linked. All six migrations applied successfully. Auth Site URL, callback allowlist and password policy are configured. Custom confirmation/recovery templates were rejected by Supabase because the Free default email provider disallows template changes; the failed request was followed by a successful settings-only update. Custom SMTP is required before applying templates and validating hosted registration/recovery. User proposed Seznam SMTP; an ignored `.env.hosted.local` contains empty SMTP_USER, SMTP_PASSWORD and SMTP_ADMIN_EMAIL fields for secure local entry. The unrelated visa-assist project was not modified. Hosted accounts and full workflows remain untested.


## SMTP and deployment — 2026-09-12

Seznam SMTP authentication was verified over TLS without sending a message. Custom SMTP and both email templates were then accepted by hosted Supabase. The Vercel Git integration is connected to the private repository. Initial production deployment succeeded but HTTP smoke checks caught a legacy anon key being selected where the application requires the publishable key; the configuration was corrected to the actual publishable key and rebuilt. No service-role key is used in the application. Email delivery, signup/recovery and an authenticated full AI workflow still require hosted verification.


## Hosted workflow test — 2026-09-12

Problem `9693f58e-5560-4980-9795-63476e226f9f` is an explicitly fictional video-meeting scenario in the user's account. First attempt failed at intake with INVALID_OUTPUT; the original response was not logged and the cause remains unconfirmed. Both a baseline and the exact Czech intake passed locally against live Nebius. Commit 631d2dc adds safe stage-only response diagnostics and the Czech live regression; 214 offline tests, lint, typecheck and production build passed.

One explicit retry on that deployed commit successfully paused for four human questions. Submitted fictional answers were saved, the same run resumed, and all stages completed (resume 20:26:49, completed 20:27:17 Prague time). UI shows 100%, persisted answers and proposed tasks. Research quality is not yet satisfactory: retrieved sources were poorly relevant, no supported claims were extracted, and the decision abstained with low confidence. The final result also repeats an uncertainty about messaging despite the clarification. These are remaining query/context quality issues, not a demonstrated reliable recommendation. No external messages or task actions were executed. Recovery email flow still needs hosted verification.


## Avenli rename and prompt refinement — 2026-09-12

User renamed the application to Avenli and assigned `avenli.vercel.app` to the same Vercel project. UI branding, title metadata and email templates now use Avenli. Hosted SITE_URL and Supabase Auth Site URL/callback allowlist target the new domain; SMTP sender name and email subjects/templates were updated. Existing database IDs, HMAC namespace and repository remain stable so existing records and pending jobs retain identity. Users need a new browser session on the new hostname.

Planner instructions now require self-contained search queries with explicit product/service names and a prioritized decision-critical query. All agents are instructed to reconcile clear user responses with earlier assumptions and personal-preference unknowns. This is a prompt refinement, not a guarantee of search relevance. The live planner contract test passed; full improved research relevance still requires a fresh evaluation.

## Persistent agent — 2026-09-12

Phase 10 adds bounded checkpoint recovery and daily monitoring for Vercel Hobby. A timeout yields the current validated workflow snapshot back to a queued job; opening the problem resumes from its unfinished state. An expired running lease can also be recovered, with three renewals per run. The original run ID and attempt count remain unchanged.

Completed analyses can have owner-scoped monitoring conditions. The daily Vercel cron claims at most two rows, evaluates current Tavily evidence with Nebius, and returns a problem to `action_required` only when the exact condition is supported. Production additionally requires server-only `SUPABASE_SECRET_KEY` and `CRON_SECRET`. See [persistent-agent.md](persistent-agent.md) for limits and security boundaries.

## Notifications — 2026-09-13

The phase 10 production deployment was Ready at commit ab02a61. Its cron endpoint returned 401 without authorization and 200 with an empty queue when authorized. This verifies configuration, not a live monitored-condition assessment.

Phase 11 introduces the in-app inbox, persisted preferences and transactional event abstraction. The hosted migration `20260913000000_notifications.sql` applied successfully and hosted database lint returned no schema errors. Local validation passed 227 tests, lint, TypeScript and the production build used by Playwright. All 13 executed browser scenarios passed (the new notification UI scenario uses explicit HTTP fixtures); three live-provider cases were skipped. User-supplied brand/UI references are saved for the later web redesign.

## Account management — 2026-09-13

Phase 12 implements saved profile fields, current-password verified password changes, complete owner-scoped JSON export and reauthenticated account deletion. The export migrations applied to hosted Supabase; the final static-query export passed hosted database lint. Browser tests use the isolated Auth test double; a live Google first sign-in, callback, logout and repeat sign-in were verified on `avenli.vercel.app`. No real account deletion was exercised.

Google sign-in is enabled in hosted Supabase and Avenli. Apple sign-in is intentionally outside the current product scope. See [account-completion.md](account-completion.md).

## Google integrations — 2026-09-13

Phase 13 adds an optional read-only Google Calendar and Gmail connection behind `GOOGLE_INTEGRATIONS_ENABLED` and an explicit tester-email allowlist. The hosted migration `20260913030000_google_integrations.sql` applied successfully and the public/private schemas passed hosted database lint. Local validation passed 259 tests, lint, TypeScript, production build and all 14 executed browser scenarios; three live-provider scenarios were skipped. The feature remains disabled in production pending Google API, scope and credential configuration.

Google classifies `gmail.readonly` as a restricted scope. A public production app must complete the applicable OAuth verification, and server-side access to restricted data can require an annual third-party security assessment. Avenli may use the development/testing exception for a small known tester group, but the Gmail feature must not be publicly enabled before choosing and documenting that launch path. Calendar access is also kept behind the same disabled flag for this deployment.

## Optional Google services — 2026-09-14

Calendar and Gmail are now authorized, displayed and enabled independently. Disabling one service blocks its server-side reads immediately while retaining the provider grant until the user disconnects Google completely. A follow-up migration preserves this distinction when another Google service is connected later. Google Calendar API and Gmail API are enabled in the Avenli Google Cloud project, and the corresponding read-only OAuth scopes are configured.

Local validation passed 267 tests, lint, TypeScript, production build and all 14 executed browser scenarios; three live-provider scenarios were skipped. The optional-services and authorization-preservation migrations were applied to hosted Supabase and database lint passed. Production activation remains restricted to `j.kaczmarczyk96@gmail.com` while Google verification requirements are evaluated.

## External actions — 2026-09-14

Phase 14 adds one complete write-action path: a completed problem can prepare an exact Google Calendar event, obtain the narrow incremental event permission in context, require a separate review and explicit creation approval, and record every transition in an owner-readable audit log. The provider call contains no attendees and uses a deterministic action-derived event ID for retry safety. Existing Calendar and Gmail reads remain optional and independently switchable.

The hosted migration `20260914010000_external_actions.sql` applied successfully and remote database lint found no errors. Local validation passed 283 tests, lint, TypeScript, production build and all 14 executed browser scenarios; three live-provider scenarios were skipped. Commit `e60d912` is deployed to production, and the narrow `calendar.events.owned` scope is configured in Google Cloud.

The production action path was verified end to end on 2026-09-14 with the explicitly approved disposable event `Avenli Phase 14 production verification`. Avenli obtained the incremental permission in context, displayed the exact event for a second review, created it without attendees or invitations, and exposed the provider link with status `Created`. The hosted database recorded one execution attempt and the ordered audit sequence `proposed, approved, execution_started, succeeded`. The test event remains in the tester's Calendar for manual review or removal.

## Phase 15 — Web completion

Phase 15 adds the Avenli visual system, persistent three-step onboarding, desktop and mobile workspace navigation, accessibility and reduced-motion refinements, defensive browser headers, a bounded Supabase health check and owner-scoped first-party product analytics with an account opt-out. Analytics paths remove problem IDs and never accept problem text, research queries, Google content, provider data or authentication URLs. Account export version 2 includes these events.

Local validation passed 285 tests, lint, strict TypeScript and the production build. All 16 executed browser scenarios passed, including onboarding persistence, mobile overflow, health and response-header assertions; three live-provider scenarios were skipped. Hosted migration `20260914020000_web_completion.sql` applied successfully and remote database lint found no schema errors.

Commit `c4ce833` deployed successfully as Vercel production deployment `dpl_E33AgEj8tqiKGKFNTE4Kdw1Q9YYU` and is aliased to `https://avenli.vercel.app`. Post-deploy smoke checks returned 200 for the landing page, login, privacy policy and healthy dependency endpoint; the private dashboard returned the expected unauthenticated redirect and all checked pages carried the defensive headers. An existing authenticated account loaded its saved problem in the redesigned workspace and displayed the new onboarding dialog. Phase 15 is production-verified.

## Phase 16 — Testing and hardening

The regression matrix now explicitly covers prompt-injection boundaries in addition to the existing unit, integration, RLS, Auth, security, external-action, agent-failure and browser suites. Malicious user/source instructions remain model input data, shared system instructions label them untrusted, agents have no tools, and strict schemas reject appended action claims. See `docs/testing-hardening.md` for the release commands and live-provider boundary.

Local release verification passed 288 tests across 41 files, zero-warning lint, strict TypeScript, the optimized production build and all 16 executed Chromium scenarios; three opt-in live-provider scenarios were skipped. The production dependency audit reports zero known runtime vulnerabilities. No database migration is part of this phase.

## Public demo and saved task progress — 2026-09-20

The no-account fictional workspace is now available at `https://avenli.vercel.app/demo`; it does not access Supabase, providers, analytics or external services. The landing CTA points to this public route while `/dashboard` remains protected. Commit `0f8d6f0` deployed as `dpl_DC91fyABWnu1VFcm7y3rgr5fX1ZL`; production returned 200 for the demo and retained the expected 307 login redirect for the private dashboard.

Completed workflow tasks are now materialized in the owner-scoped `tasks` table and can be tracked as to do, in progress, completed or cancelled. Migration `20260920000000_task_progress.sql` backfilled prior completed snapshots and applied successfully to hosted Supabase; remote database lint found no schema errors. The immutable workflow snapshot remains unchanged, and task status changes never trigger AI or an external action. Local validation passed 293 tests across 44 files, lint, strict TypeScript, production build and 17 executed Chromium scenarios; three live-provider scenarios were skipped. Commit `9aadbfb` deployed as `dpl_AkBFxnfEArMy8BxjYwS9m7oBXDDJ`; production health and public demo returned 200, and the task mutation endpoint returned 401 without a session.

## Problem lifecycle — 2026-09-20

A completed problem can now be marked solved and reopened from its workspace. Solving sets a consistent `solved_at`, pauses active or claimed monitors and records an immutable owner-only lifecycle event; reopening keeps those monitors paused until the owner deliberately resumes them. The database rejects new or resumed monitoring while the problem remains solved, and account export version 3 includes the lifecycle audit trail.

Migration `20260920010000_problem_lifecycle.sql` applied successfully to hosted Supabase and remote database lint found no schema errors. Local validation passed 299 tests across 48 files, zero-warning lint, strict TypeScript, production build and 17 executed Chromium scenarios; three live-provider scenarios were skipped. The live-provider suite now also covers task persistence and a solved/reopened round trip when run against disposable local data.

## Task deadlines and reminders — 2026-09-20

Materialized tasks now accept a future due date without changing the immutable generated proposal. Active deadlines due within seven days appear in the dashboard summary and on problem cards. The existing daily Hobby-compatible cron emits one idempotent in-app reminder per task and saved deadline when it is due within 24 hours. Task reminders have an independent account preference; solved problems and completed or cancelled tasks are excluded.

Migration `20260920020000_task_deadlines.sql` applied successfully to hosted Supabase and remote database lint found no schema errors. Local validation passed 304 tests across 49 files, zero-warning lint, strict TypeScript, a production build and 17 executed Chromium scenarios; three live-provider scenarios were skipped.

## Multi-query research coverage — 2026-09-20

New analyses now research up to three distinct priority questions concurrently without adding model calls. Search results are canonicalized across queries, deduplicated, re-keyed and capped at ten bounded excerpts before the Researcher sees them. The checkpoint records the exact query set, the UI shows covered and remaining questions, and the decision receives a deterministic coverage warning when the plan contains more questions than the bounded run processed. Existing one-question checkpoints remain valid.

Local validation passed 306 tests across 49 files, zero-warning lint, strict TypeScript, a production build and 17 executed Chromium scenarios; three local-Supabase live scenarios were skipped. A focused live-provider check executed three real Tavily queries and verified the bounded, canonicalized evidence set. The full local live workflow could not run in this pass because Docker Desktop failed to start its Linux engine on a locked local socket.

## Live recommendation quality evaluation — 2026-09-21

An opt-in, database-independent evaluation now runs the complete eight-agent workflow against Nebius/NVIDIA and Tavily for three materially different scenarios. Its deterministic 100-point report checks multi-question coverage, canonical and independent sources, claim-by-claim verification, primary-source use, adversarial critique, citation-safe decisions, conservative confidence and valid proposed tasks. All three scenarios completed and met the required gates during development.

The evaluation exposed an intermittent Verifier response that satisfied the JSON schema but violated cross-agent reference integrity. Agents now make at most one repair generation only for `INVALID_OUTPUT`, reusing the same validated input and evidence; the replacement must pass the full schema and integrity checks. Timeouts, cancellation, refusal, authentication, rate limits and provider failures remain non-retriable. Offline validation passes 307 tests across 49 files, zero-warning lint, strict TypeScript, production build and 17 Chromium scenarios; three local-Supabase live scenarios remain skipped until the Windows-held Docker socket is released.

## Focused follow-up analysis — 2026-09-21

Every decision-level unresolved unknown can now start a separate focused analysis after an explicit user click. The quota-counted follow-up includes the original goal, the exact selected question and instructions to preserve unsupported details as unknowns and avoid external actions. This keeps the original decision snapshot immutable while implementing the PRD's `Resolve unknown` path without hidden provider spend or automatic writes.

Local verification passes 309 tests across 50 files, zero-warning lint, strict TypeScript, the production build and 17 executed Chromium scenarios; the three local-Supabase scenarios remain skipped because the damaged Windows Docker socket still requires an administrator-approved boot-time repair.

Commit `84451fd` deployed as `dpl_J7NpTDdcN2hjb1XQPcMHRxAKETSW`. A reversible production check on the existing fictional Phase 14 review problem showed the `Solved` state, closure timestamp and `Marked solved` history entry, then restored the problem to its prior open state through `Reopen problem`; the ordered history contains both transitions.

## Full interface redesign — 2026-09-21

The landing, authentication and authenticated workspace now apply the supplied Avenli visual direction throughout the live product: bright layered surfaces, navy hierarchy, restrained blue/violet gradients, compact dashboard statistics, a recent-problems list, clearer primary actions and responsive desktop/mobile navigation. Problem detail uses a structured two-column overview on larger screens, while account settings, notifications and the new-problem flow share the same panel and heading system.

The public demo and authenticated components continue to expose the same implemented behavior and accessible labels, so the visual work did not replace product state with mock data. Release screenshots for the landing page and desktop/mobile workspace were regenerated from the production build. Local verification passed 309 tests across 50 files, zero-warning lint, strict TypeScript, the optimized production build and 17 executed Chromium scenarios; three Docker-dependent local-Supabase scenarios remain skipped because of the Windows-held Docker socket.

## Evidence abstention guard — 2026-09-21

A production release-check analysis completed all eight stages but exposed a conservative-policy gap: the Verifier retained no traceable supporting excerpts, while the Decision still selected an option at Low confidence. Quality policy two now deterministically clears the selection and citations when no verified or partially verified claim has a grounded excerpt, records the missing support as an unresolved unknown and permits only review or information-gathering tasks. Policy-one checkpoints remain readable and immutable.

Local verification passed 310 tests across 50 files, zero-warning lint, strict TypeScript, the optimized production build, all 17 normal Chromium scenarios and the production dependency audit with zero known vulnerabilities. The three Docker-dependent local-Supabase scenarios remain skipped.
