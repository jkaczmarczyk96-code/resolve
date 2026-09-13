# Account completion — phase 12

Implemented: `/settings` edits the display name, HTTPS avatar image URL, timezone and language preference; changes persist in the existing owner-scoped profile. The current UI remains English. The fictional settings preview remains available only with `?demo=1`.

Password changes verify the current password using a nonpersistent Supabase client and require the resulting user ID to match the verified browser account. Password confirmation and the existing strength rules apply. OAuth-only users can use the existing email recovery flow to establish a password.

`/api/account/export` downloads a versioned JSON export of the authenticated account's profile and all current workspace tables. Its database function uses a fixed table allowlist and filters each table by ownership; web-run secret tokens and Auth credentials are excluded. Errors fail the download rather than returning silently truncated data.

Account deletion requires the exact confirmation `DELETE` and either a newly verified password or an OAuth AMR timestamp less than five minutes old in the verified current session. The server deletes only `identity().user.id` using its existing server-only Supabase key. Foreign keys cascade owned workspace records. No actual user account was deleted during implementation testing; database tests use synthetic Auth rows and route tests mock the admin provider. Already-issued JWTs may remain valid until expiry at Supabase; the application verifies account existence with `getUser` on private requests, and owned database records are deleted.

## OAuth implementation and remaining setup

Server-side `/auth/oauth` accepts only same-origin POSTs and the enabled Google/Apple allowlist. Supabase SSR supplies PKCE; `/auth/callback` exchanges the one-time code and requires a session plus user before redirecting to a validated private path. Existing signup/recovery callbacks remain separate. Supabase handles provider identity verification and linking; the app does not copy accounts or manually link identities by email. Existing Auth profile triggers create a profile for new OAuth users even when a provider does not supply a display name.

As of 2026-09-13 Google is configured in Supabase and enabled in production. Its Google Cloud consent app remains in testing mode with the project owner registered as a test user while the public branding fields and publication are completed. Apple remains disabled, so **phase 12 is not fully verified**. Keep `AUTH_APPLE_ENABLED` unset until the Apple provider is configured and tested.

Google: the Web application client uses `https://omdtlsmhxsudxqvoahfz.supabase.co/auth/v1/callback` as its authorized redirect URI. Before opening sign-in to everyone, complete the public home, privacy-policy and terms links in Google Cloud, publish the consent app, and run the public sign-in checks.

Apple: configure a Services ID and Sign in with Apple in an Apple Developer account, using the same Supabase callback URL. Configure the Services ID and generated client secret in the Apple provider. The web OAuth secret needs renewal at most every six months. Then enable the matching Avenli environment flag and verify a new sign-in, returning sign-in, cancellation, logout and PKCE replay failure on `avenli.vercel.app`.

Provider credentials belong in Supabase, never in browser variables or source control. Only the nonsecret enable flags belong in Vercel. Preserve `https://avenli.vercel.app/auth/callback*` in the Supabase redirect allowlist.

References: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase Apple setup](https://supabase.com/docs/guides/auth/social-login/auth-apple), [User deletion](https://supabase.com/docs/guides/auth/managing-user-data).
