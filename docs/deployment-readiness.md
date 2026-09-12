# GitHub, hosted Supabase and Vercel

The repository currently has no Git remote and no selected hosted projects. Phase 9 adds a GitHub Actions workflow for lint, TypeScript, offline tests and production build. It requires no provider secrets; live paid tests are intentionally separate. `.env.local`, build outputs and test artifacts remain ignored.

The next delivery steps are:

1. Select the GitHub repository, review the initial source commit and push. Confirm CI passes.
2. Select the hosted Supabase project and apply all migrations without importing local test accounts. Configure production Site URL, exact auth callback URLs and the existing confirmation/recovery email templates; configure production email delivery separately. The local TOML does not automatically configure hosted Auth.
3. Resolve the worker runtime boundary, configure Vercel environment variables, deploy a preview against a separate preview database, then verify signup, recovery, ownership isolation, analysis, questions and continuation before using the production URL.

The user selected Vercel Hobby on 2026-09-11. The three mutation routes now declare `maxDuration=300`. Their worker budget is 240 seconds measured from the start of the POST handler, including authentication, reservation and claim time, leaving 60 seconds for cancellation and bounded final status writes. Provider calls receive the shared abort signal and no new paid calls or checkpoint writes start after the deadline. Expiry ends the web job as failed; the existing manual retry creates a fresh run and consumes the existing attempt quota. This is not automatic checkpoint recovery. Slow analyses may require another attempt; phase 10 remains the planned durable execution work. Enable Fluid Compute on the selected Hobby project and verify actual hosted completion and timeout behavior before production use.

Access check on 2026-09-11: GitHub connector account is `jkaczmarczyk96-code`, with two unrelated repositories returned by the owner-affiliation list and no Resolve repository; no Git remote is configured. Supabase CLI sees only the unrelated `visa-assist` project, which must remain untouched. Vercel CLI authentication succeeded. On 2026-09-12, the separate Vercel project `resolve` was created under `jkaczmarczyk96-codes-projects` and linked locally (project ID `prj_Odh11f1mChXsiGz2mSJrLBmRnA59`). The repository now explicitly selects the Next.js framework in `vercel.json`. No deployment has been made and no database migrations have been applied remotely. Local validation of the Hobby adjustment: 214 offline tests, lint, TypeScript and production build passed; hosted behavior remains unverified.

Production configuration needs the hosted Supabase public URL/publishable key, trusted `SITE_URL`, and server-only Nebius/Tavily keys. Keep production and preview secrets and data separate. The current worker signing token is derived from the Nebius key; pending human requests require that key to remain stable. Local success does not prove hosted email or function lifecycle behavior.

References: [Vercel function limits](https://vercel.com/docs/functions/limitations), [Next after](https://nextjs.org/docs/app/api-reference/functions/after), and the project's [authentication guide](authentication.md).
