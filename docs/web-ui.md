# Phase 3 — Interactive web UI

Historical demo behavior. Since Phase 7, use `?demo=1` on dashboard/list/new routes; UUID problems open the live workspace documented in [live-workspace.md](live-workspace.md). Demo IDs keep their own isolated temporary state.

## Screens

- `/dashboard`: personalized welcome, demo counts, a sample attention request, scenario cards, and next tasks.
- `/problems`: searchable scenario/draft list with status filters and an empty state.
- `/problems/new`: validated temporary draft input and shortcuts to three fictional examples.
- `/problems/[id]`: goal, constraints, unknowns, illustrative progress/confidence, current priority, recommendation, plan, activity, research/evidence, options comparison, risks, tasks, and decision trail.
- `/settings`: real read-only profile/account details plus temporary language, timezone, and notification preference previews. Password recovery still invokes the real Phase 2 flow.

Workspace section navigation uses accessible links with the `view` query parameter. It supports browser history and direct links. Unknown non-demo IDs return 404; a cleared temporary draft displays an explanatory empty state. Loading and error boundaries cover protected pages.

## Explicit demo boundary

The Cancelled Flight, Moving Abroad, and Product Launch scenarios are fictional static data in `src/lib/demo/data.ts`. All prices and timing are illustrative. No research sources were fetched; every evidence record is visibly unverified, with no invented URL. Activity is a sample event list, not a live agent feed. Confidence is labeled as sample data, not calculated by an AI.

Demo state lives only in the React provider inside the authenticated workspace layout, keyed to the account ID. It survives in-app navigation but clears on full reload, sign-out, or Reset demo. It is never written to localStorage, sessionStorage, Supabase, or an external service. Only the existing Auth/profile functionality accesses the real account.

Creating a draft stores the supplied description without fabricating constraints, plans, tasks, risks, research, or a recommendation. The button says **Create demo draft** rather than implying that solving will run. Task checkboxes update demo state only. Option comparison changes the visible comparison. Preview preferences are retained only in the open demo session; they do not change the account, UI language, or notification delivery.

Answer collection, workflow resumption, real problem persistence, research, AI agents, integrations, external actions, account editing, and notifications are not implemented. There is no new database migration in this phase.

## Code organization

- `src/lib/demo/`: typed fixtures and bounded draft validation/construction.
- `src/components/demo/`: shared provider/shell/primitives and screen components.
- `src/lib/auth/profile.ts`: request-cached, verified access to the real account profile.
- `src/app/(workspace)/`: protected route wrappers. The UI does not replace the existing authorization/RLS boundaries.

## Verification

`tests/demo-draft.test.ts` checks that a draft preserves the input without invented analysis and enforces input bounds. Browser tests in `tests/e2e/workspace.spec.ts` cover search/filter empty states, section navigation, evidence labels, option selection, decision links, temporary task state, draft clearing, preview settings, and narrow-screen overflow. Existing Auth/RLS tests remain part of the same live Supabase suite.

No mobile application or AI backend was added. Phase 4 requires a separate instruction.

Verification completed with 79 unit/database tests and 13 browser tests against the local Supabase stack, plus lint, TypeScript checking, and a production build. On this Windows host the Playwright-managed web server exited during repeat runs; running the production server separately kept the full suite stable. To use an already-built local server on port 3000, set `RESOLVE_E2E_REUSE_SERVER=1` before `npm run test:e2e:live`. The default still starts an isolated server and refuses to reuse an existing one.
