# Phase 2 — Authentication

## Configuration

Set the public Supabase URL/key and trusted `SITE_URL` in `.env.local`; see `.env.example`. Local API: `http://127.0.0.1:55421`; app: `http://127.0.0.1:3000`; Mailpit: `http://127.0.0.1:55424`. HTTPS is required for non-local app origins. No service-role client is used.

Apply both SQL migrations. Profile creation runs in the Auth transaction using a definer function with an empty search path. It takes only a bounded string display name from untrusted metadata, defaults region/language, and cannot be invoked by API roles. Existing profiles are preserved during backfill.

## Hosted project setup

The SQL migrations do not apply Supabase Auth dashboard settings. Before using a hosted project:

1. Set Auth Site URL to the same origin as `SITE_URL`.
2. Allow that origin's `/auth/callback**` redirect URL.
3. Require passwords of at least 12 characters with uppercase, lowercase, and digits.
4. Copy `supabase/templates/confirmation.html` into **Confirm signup** and `supabase/templates/recovery.html` into **Reset password**. The app supplies `RedirectTo` with a trusted callback and `next` query; templates append the one-time `TokenHash` and token type.
5. Configure production SMTP and appropriate Supabase Auth rate limits. The app does not bypass provider throttling.

The callback accepts `token_hash` with `type=signup` or `type=recovery`. Default implicit-flow email templates and generic OAuth/PKCE code callbacks are not accepted in this phase; the custom templates are required. OAuth is a later phase. Local templates/settings are already wired in `supabase/config.toml`.

## Recovery

1. A POST Server Action requests a recovery email. Existing/unknown accounts, throttling, and provider failures receive identical response content. This does not promise identical network timing.
2. The email callback stores the token hash in a 10-minute **HttpOnly, SameSite=Lax cookie**, Secure on HTTPS, and redirects to `/reset-password` without the token in the URL. Auth responses are private/no-store and no-referrer.
3. GET does not consume recovery tokens, so email scanners cannot invalidate a link. A displayed form means only that a pending token exists; validity is checked when submitted.
4. A valid new password triggers `verifyOtp(type=recovery)` on a nonpersistent Auth client. Both a verified user and a session are required before `updateUser`. A normal browser login alone cannot authorize a reset; editing the pending cookie cannot forge a valid Supabase token.
5. The pending cookie is cleared. On success, sessions are revoked and the user returns to login. Invalid/expired/replayed tokens and missing sessions fail safely. If a provider error occurs after token consumption, request a new link. Recovery works in a different browser from the request.
6. Cookie changes rerender Server Components. Fixed error codes preserve failure messages through that render; no raw provider errors or token values are reflected.

The initial email URL contains a credential. Production ingress/access logs must redact callback query strings. No analytics or third-party scripts collect auth URLs here.

## Sessions and authorization

Supabase SSR session cookies use SameSite=Lax and Secure on HTTPS. They remain browser-readable for the prepared browser client; recovery proof is separately HttpOnly. Proxy propagates refreshed cookies to both the request and response, including redirects. The layout and each private data entry point also verify identity with Auth `getUser()`. RLS remains active. No authorization relies on `getSession()` or unverified cookie payloads.

All credential mutations and logout use POST Server Actions with Next.js Origin/Host validation. Email confirmation is a bearer-link callback. Return URLs are constrained to known same-origin private routes. No personal data is statically cached.

## Tests

- `npm test`: schema/redirect tests, mocked actions/callbacks, PostgreSQL/PGlite RLS and profile tests.
- `npm run test:e2e`: Chromium + production Next.js against an isolated HTTP test double, never an application fallback.
- `npm run test:e2e:live`: the same browser flows against the actual local Supabase Auth/PostgREST/Mailpit stack. The launcher rejects a hosted URL.
- Both browser suites cover signup/confirmation, persistent session, logout/login, cross-browser recovery, replay rejection, private routes, small-screen forms, safe redirects, cookie refresh, and foreign-Origin rejection.
- Browser traces are disabled to avoid persisting credentials/token URLs. Local test accounts use a `resolve-<uuid>@example.com` address.

The local suite does not validate production SMTP, cloud redirect configuration, OAuth, or future problem workflows. Test-double runs alone must never be described as live Supabase verification.

## Verification recorded — 2026-09-09

- 77 unit/SQL integration tests passed.
- 9 Chromium tests passed against this project's real local Supabase Auth, PostgREST, and Mailpit, including two-user CRUD isolation through the API.
- The test-double browser suite also passed before live verification.
- Lint, TypeScript checking, production build, and `supabase db lint --local --schema public` passed.
- Both migrations applied to the local PostgreSQL database. `.env.local` contains only local public configuration and is Git-ignored.

Phase 2 is complete. Its auth flows remain covered by regression tests as the Phase 3 demo UI is added.
