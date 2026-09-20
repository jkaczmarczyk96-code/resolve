# Route structure

The application separates public/auth routes, a fictional public demo and the protected saved workspace. Global layout, loading, error and not-found boundaries are included.

| Directory under `src/app` | Future URL | Access / implementation |
| --- | --- | --- |
| `(auth)/login` | `/login` | Implemented; safe private return URL |
| `(auth)/register` | `/register` | Implemented; confirmation state |
| `(auth)/forgot-password` | `/forgot-password` | Implemented; account-neutral response |
| `(auth)/reset-password` | `/reset-password` | Implemented; requires fresh recovery proof |
| `auth/callback` | `/auth/callback` | Implemented; custom email templates required |
| `demo` | `/demo` | Public fictional dashboard; no account, database, AI, analytics or external-service calls |
| `demo/problems` | `/demo/problems` | Public searchable fictional scenarios |
| `demo/problems/new` | `/demo/problems/new` | Public temporary in-memory draft |
| `demo/problems/[id]` | `/demo/problems/[id]` | Public fictional workspace; only allowlisted demo IDs or current-session draft IDs |
| `(workspace)/dashboard` | `/dashboard` | Protected saved-problem overview; `?demo=1` for examples |
| `(workspace)/problems` | `/problems` | Protected, searchable saved list; `?demo=1` for examples |
| `(workspace)/problems/new` | `/problems/new` | Protected live submission; `?demo=1` for temporary drafts |
| `(workspace)/problems/[id]` | `/problems/[id]` | UUID: saved live workspace; demo-/draft-: temporary examples |
| `(workspace)/notifications` | `/notifications` | Protected saved notification inbox |
| `(workspace)/settings` | `/settings` | Protected real profile + explicit demo preference controls |

Route groups do not provide security by themselves. Proxy refreshes sessions and guards private routes; protected pages independently verify identity through Auth `getUser()`. RLS remains active. The `/demo` tree has a separate layout with static fictional data and no authenticated components. APIs and actions perform their own authorization. Auth pages are dynamic/private/no-store; credential mutations and logout use POST Server Actions with Next.js Origin/Host validation.

## Phase 7 APIs

- `GET /api/problems`: latest 100 owned problems and their latest jobs.
- `POST /api/problems`: `{ requestId: UUID, description }`; reserves a job and returns 202.
- `GET /api/problems/[id]`: owned problem, latest job and validated saved full snapshot.
- `POST /api/problems/[id]/respond`: `{ requestId: UUID, runId: UUID, answers: string[] }`; saves answers and continues the same waiting analysis.
- `POST /api/problems/[id]/retry`: `{ requestId: UUID }`; explicitly reserves a fresh attempt.
- `PATCH /api/problems/[id]/tasks`: update one materialized task status or future due date inside the owned problem.
- `PATCH /api/problems/[id]/resolution`: mark a completed problem solved or reopen it; solving pauses its active monitoring conditions.
- `POST /api/account/onboarding`: persist completed or skipped onboarding for the verified account.
- `POST /api/account/analytics`: enable or disable first-party product analytics.
- `POST /api/analytics`: record one allowlisted, normalized account event.
- `GET /api/health`: bounded public dependency status without configuration or account data.

All handlers verify Auth identity and return private/no-store responses. Mutations require the configured `SITE_URL` Origin, JSON content type and a bounded request body. Foreign problem IDs return 404; missing sessions return 401. Background work keeps the verified user's RLS scope.
