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
