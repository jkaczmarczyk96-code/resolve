# Google integrations — phase 13

Phase 13 connects Google Calendar and Gmail as optional, read-only context sources. The feature remains dormant until `GOOGLE_INTEGRATIONS_ENABLED=true` and all server-only credentials are configured. A signed ten-minute HttpOnly state binds the OAuth return to the Avenli account that started it. The callback requires both exact read-only scopes and rejects a different Google email.

The public `integrations` table stores only connection status, email, scopes and timestamps. Provider access and refresh tokens are encrypted with AES-256-GCM using `INTEGRATION_ENCRYPTION_KEY` and stored in `private.integration_credentials`. Authenticated users cannot query the private schema. Service-role functions expose only bounded credential operations to the server. Row-level security limits connection metadata and audit events to their owner.

The Calendar preview reads at most fifty non-cancelled events from the next one to thirty days. Gmail searches at most ten messages and requests the metadata representation with Subject, From and Date headers plus the provider's short snippet; message bodies are not requested. Audit rows record the operation, result count and calendar window. Gmail query text, provider tokens and returned content are not written to the audit log.

Disconnect first attempts Google's token-revocation endpoint, then always deletes the local credential and marks the connection disconnected. Account export includes connection metadata and audit rows but never credentials. Account deletion cascades both public integration records and the private credential row.

Before enabling production, apply `20260913030000_google_integrations.sql`, set the three server-only Google variables and enable the Gmail and Calendar APIs in the existing Google Cloud project. Add the two read-only scopes to the OAuth consent configuration and complete any Google verification required for external users. Then enable the feature flag and verify connect, account mismatch, calendar read, Gmail search, expired-token refresh, disconnect and reconnect on `avenli.vercel.app`.
