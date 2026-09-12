# GitHub, hosted Supabase and Vercel

Current production: https://resolve-nine.vercel.app. Source: private GitHub repository `jkaczmarczyk96-code/resolve`, branch `master`. Vercel Hobby and the dedicated Supabase Free project are connected. GitHub Actions run 34699219758 passed lint, TypeScript, all offline tests and production build for commit 77fd216. Local secrets and build/test outputs are ignored.

Hosted verification: landing/login/register pages return HTTP 200; an unauthenticated API request returns 401 and dashboard navigation redirects to login. The user confirmed successful signup and email confirmation on 2026-09-12. Recovery and the authenticated AI workflow still require hosted verification. Preview environments do not have production credentials; configure an isolated database before preview testing.

The user selected Vercel Hobby on 2026-09-11. The three mutation routes now declare `maxDuration=300`. Their worker budget is 240 seconds measured from the start of the POST handler, including authentication, reservation and claim time, leaving 60 seconds for cancellation and bounded final status writes. Provider calls receive the shared abort signal and no new paid calls or checkpoint writes start after the deadline. Expiry ends the web job as failed; the existing manual retry creates a fresh run and consumes the existing attempt quota. This is not automatic checkpoint recovery. Slow analyses may require another attempt; phase 10 remains the planned durable execution work. Enable Fluid Compute on the selected Hobby project and verify actual hosted completion and timeout behavior before production use.

Access check on 2026-09-11: GitHub connector account is `jkaczmarczyk96-code`, with two unrelated repositories returned by the owner-affiliation list and no Resolve repository; no Git remote is configured. Supabase CLI sees only the unrelated `visa-assist` project, which must remain untouched. Vercel CLI authentication succeeded. On 2026-09-12, the separate Vercel project `resolve` was created under `jkaczmarczyk96-codes-projects` and linked locally (project ID `prj_Odh11f1mChXsiGz2mSJrLBmRnA59`). The repository now explicitly selects the Next.js framework in `vercel.json`. No deployment has been made and no database migrations have been applied remotely. Local validation of the Hobby adjustment: 214 offline tests, lint, TypeScript and production build passed; hosted behavior remains unverified.

Production configuration needs the hosted Supabase public URL/publishable key, trusted `SITE_URL`, and server-only Nebius/Tavily keys. Keep production and preview secrets and data separate. The current worker signing token is derived from the Nebius key; pending human requests require that key to remain stable. Local success does not prove hosted email or function lifecycle behavior.

References: [Vercel function limits](https://vercel.com/docs/functions/limitations), [Next after](https://nextjs.org/docs/app/api-reference/functions/after), and the project's [authentication guide](authentication.md).


## Hosted setup — 2026-09-12

Source is pushed to the private `jkaczmarczyk96-code/resolve` repository, branch `master`. Vercel Hobby is verified; the assigned domain is `resolve-nine.vercel.app`. Production environment configuration contains the hosted public Supabase URL/key, SITE_URL, and server-only Nebius/Tavily secrets. No deployment has been published.

The dedicated Free Supabase project `omdtlsmhxsudxqvoahfz` (`resolve`, Frankfurt) is created and linked. All six migrations applied successfully. Auth Site URL, callback allowlist and password policy are configured. Custom confirmation/recovery templates were rejected by Supabase because the Free default email provider disallows template changes; the failed request was followed by a successful settings-only update. Custom SMTP is required before applying templates and validating hosted registration/recovery. User proposed Seznam SMTP; an ignored `.env.hosted.local` contains empty SMTP_USER, SMTP_PASSWORD and SMTP_ADMIN_EMAIL fields for secure local entry. The unrelated visa-assist project was not modified. Hosted accounts and full workflows remain untested.


## SMTP and deployment — 2026-09-12

Seznam SMTP authentication was verified over TLS without sending a message. Custom SMTP and both email templates were then accepted by hosted Supabase. The Vercel Git integration is connected to the private repository. Initial production deployment succeeded but HTTP smoke checks caught a legacy anon key being selected where the application requires the publishable key; the configuration was corrected to the actual publishable key and rebuilt. No service-role key is used in the application. Email delivery, signup/recovery and an authenticated full AI workflow still require hosted verification.
