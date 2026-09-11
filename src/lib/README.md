# Resolve Core boundaries

Phases 1–9 implement `config/`, `database/`, `supabase/`, `auth/`, `demo/`, `ai/`, `orchestration/`, `workspace/`, and `utils.ts`.

- `config/public-env.ts`: explicit public configuration, validated lazily. Only modern Supabase publishable keys are accepted; never use secret/service-role keys here.
- `database/types.ts`: schema-derived database contract; regenerate with `npm run db:types`.
- `supabase/client.ts`: browser client using the public key and user-scoped RLS.
- `supabase/server.ts`: request-scoped cookie adapter, marked `server-only`. Server Components read cookies; Actions/Route Handlers opt into `writable: true`. Proxy refreshes before rendering and forwards updated cookies.
- `supabase/ephemeral.ts`: nonpersistent Auth client for recovery. It does not overwrite another account's browser session.
- `config/server-env.ts`: trusted `SITE_URL` for links, never derived from an untrusted Host header.
- `auth/`: schemas, safe private redirects, Server Actions, verified identity, and short-lived recovery proof.
- `auth/profile.ts`: request-cached profile access after identity verification.
- `demo/`: typed fictional scenarios and temporary draft validation. No database or AI operations.
- `ai/`: server-only Nebius and Tavily adapters, strict agent contracts, quote grounding, deterministic evidence review, reference validation and independent single-agent invocations. No public routes, database writes or orchestration. The web caller adds identity, ownership and durable quota checks in `workspace/`.
- `orchestration/`: basic and full eight-stage workflows with versioned Supabase checkpoints, read through a verified user-scoped client. Tasks are proposals only. No automatic resume or external actions.

- `workspace/`: client-safe contracts, authenticated HTTP boundaries, owned reads, durable reservation, protected human responses and detached finite execution. The UI only starts work through validated POST routes; polling reads saved results.

Future boundaries (not implemented): broader `database/` repositories, `core/` business logic, automatic workflow resume, and independent `integrations/`, `actions/`, and `notifications/` modules. Search retrieval currently lives in `ai/research.ts` behind an injectable interface. Only presentation belongs in `app/` and `components/`.

Each private data entry point verifies identity through Auth `getUser()` before accessing RLS-protected data. Do not authorize through `getSession()` or an unverified cookie payload. No service-role client or AI/business placeholder is included.
