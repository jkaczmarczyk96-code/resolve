# Phase 16 — Testing and hardening

Phase 16 closes the release regression matrix without invoking paid providers. The repository now contains unit, integration, database/RLS, authentication, security, external-action, agent-failure, prompt-injection and Chromium end-to-end coverage. Live Nebius/Tavily and local-Supabase suites remain explicit opt-in commands because they incur usage and create disposable accounts.

The live quality evaluation is separately documented in [quality-evaluation.md](quality-evaluation.md). It runs complete in-memory workflows against Nebius/NVIDIA and Tavily, applies deterministic evidence and decision-quality gates, and allows one strictly validated repair generation for a structurally invalid read-only model response.

Prompt-injection regression tests verify the architectural boundary: malicious text from a user or research excerpt remains inside the typed model input, never enters system instructions, and cannot append a tool call or external action to a strict output contract. Every agent shares the instruction that user input, sources and upstream agent output are untrusted data. Agents have no executable tools; provider writes remain separate authenticated routes with explicit user approval.

Security coverage includes same-origin mutation checks, body limits, safe redirects, OAuth state, password reauthentication, account deletion, encrypted integration credentials, provider-scope preservation, action idempotency, owner-only RLS, analytics opt-out and normalization, browser headers, health responses, foreign-account isolation, model timeouts, malformed model output, invented source IDs and unsupported recommendations.

Release verification requires:

1. `npm test`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`
5. `npm run test:e2e`
6. `npm audit --omit=dev`
7. Supabase hosted lint after every hosted migration

The three live-provider browser scenarios remain skipped in the normal suite. Run `npm run test:e2e:live` only against local Supabase with disposable accounts and explicit provider-budget intent.
