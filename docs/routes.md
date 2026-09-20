# Route structure

Phases 2–3 implement the public/auth routes and protected dashboard, problem, new-draft, workspace, and settings screens. Global layout, loading, error, and not-found boundaries are included.

The notification directory remains reserved with no UI yet. Unauthenticated requests redirect to login through proxy; authenticated notification requests return 404 until its implementation phase.

| Directory under `src/app` | Future URL | Access / implementation |
| --- | --- | --- |
| `(auth)/login` | `/login` | Implemented; safe private return URL |
| `(auth)/register` | `/register` | Implemented; confirmation state |
| `(auth)/forgot-password` | `/forgot-password` | Implemented; account-neutral response |
| `(auth)/reset-password` | `/reset-password` | Implemented; requires fresh recovery proof |
| `auth/callback` | `/auth/callback` | Implemented; custom email templates required |
| `(workspace)/dashboard` | `/dashboard` | Protected saved-problem overview; `?demo=1` for examples |
| `(workspace)/problems` | `/problems` | Protected, searchable saved list; `?demo=1` for examples |
| `(workspace)/problems/new` | `/problems/new` | Protected live submission; `?demo=1` for temporary drafts |
| `(workspace)/problems/[id]` | `/problems/[id]` | UUID: saved live workspace; demo-/draft-: temporary examples |
| `(workspace)/notifications` | `/notifications` | Protected; later notification phase |
| `(workspace)/settings` | `/settings` | Protected real profile + explicit demo preference controls |

Route groups do not provide security by themselves. Proxy refreshes sessions and guards private routes; the workspace layout and dashboard independently verify identity through Auth `getUser()`. RLS remains active. Future APIs and actions must perform their own authorization. Auth pages are dynamic/private/no-store; credential mutations and logout use POST Server Actions with Next.js Origin/Host validation.

## Phase 7 APIs

- `GET /api/problems`: latest 100 owned problems and their latest jobs.
- `POST /api/problems`: `{ requestId: UUID, description }`; reserves a job and returns 202.
- `GET /api/problems/[id]`: owned problem, latest job and validated saved full snapshot.
- `POST /api/problems/[id]/respond`: `{ requestId: UUID, runId: UUID, answers: string[] }`; saves answers and continues the same waiting analysis.
- `POST /api/problems/[id]/retry`: `{ requestId: UUID }`; explicitly reserves a fresh attempt.
- `POST /api/account/onboarding`: persist completed or skipped onboarding for the verified account.
- `POST /api/account/analytics`: enable or disable first-party product analytics.
- `POST /api/analytics`: record one allowlisted, normalized account event.
- `GET /api/health`: bounded public dependency status without configuration or account data.

All handlers verify Auth identity and return private/no-store responses. Mutations require the configured `SITE_URL` Origin, JSON content type and a bounded request body. Foreign problem IDs return 404; missing sessions return 401. Background work keeps the verified user's RLS scope.
