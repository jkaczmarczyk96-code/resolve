# Phase 15 — Web completion

Phase 15 applies the Avenli brand direction to the public site, authentication and the complete workspace without changing the workflow contracts. The interface uses the supplied navy, blue and violet direction, a code-native Avenli mark, calmer card hierarchy and responsive layouts. Desktop uses a persistent workspace rail; compact screens use a five-position bottom navigation with the primary problem action in the center.

## Onboarding and product behavior

New and existing accounts without `profiles.onboarding_completed_at` see a three-step accessible dialog: describe the outcome, review research and options, and retain control over every external action. Completing or skipping it persists the choice so it does not reappear. The walkthrough does not invent data or start an analysis.

The home page, authentication card, dashboard metrics, problem cards, new-problem composer, settings and mobile navigation now share the same visual system. Loading, error and empty states remain explicit. Reduced-motion preferences disable decorative motion, keyboard focus stays visible, landmarks and dialog labels are retained, and narrow-screen regression tests guard against document overflow.

## Private product analytics

`product_events` stores a small allowlist of first-party events under the authenticated account. Problem identifiers are normalized to `/problems/:id`; query strings, problem text, search text, email/Calendar content, auth URLs and provider credentials are never accepted. A security-definer RPC enforces the allowlist, a 2 KB property limit and 120 events per account per hour. Direct writes are revoked and owner-only RLS protects reads.

Analytics can be disabled independently in Settings. The RPC stops recording immediately when disabled. Existing events are included in account export version 2 and cascade when the account is deleted. No third-party analytics script or cookie was added.

## Operations and security

`GET /api/health` performs a bounded anonymous Supabase REST check and returns only `ok` or `degraded`, the service name and check time. It never returns configuration or account data. Production responses add CSP, frame denial, MIME sniffing protection, a restrictive permissions policy, no-referrer behavior and HSTS. Existing same-origin checks, bounded JSON bodies, authentication and RLS remain the mutation boundary.

The health endpoint is suitable for an external uptime check. Vercel runtime logs remain the operational error source; they must not include request bodies, credentials or authentication query strings.

## Verification

The phase is covered by PGlite migration/RLS tests, analytics normalization and opt-out tests, onboarding persistence in Chromium, mobile navigation and overflow checks, health and security-header assertions, the existing auth/account/workspace suites, lint, strict TypeScript and a production build. Live Nebius/Tavily scenarios remain separate because they incur provider usage.
