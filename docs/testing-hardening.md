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

On 2026-10-05, Docker Desktop and the local Supabase stack ran successfully. All pending local migrations were applied. The three opt-in scenarios each passed in focused runs: real PostgREST ownership checks, human-input pause/resume, and the saved workspace with an explicit retry. A subsequent combined run passed 19 of 20 browser scenarios; one repeat of the retry flow failed because the live verifier returned `INVALID_OUTPUT` after its repair attempt. This is a model-output reliability limit, not a database startup failure. The test now reports a failed run immediately with its error code. The workspace scenario passed again in a focused run after the Next.js 16.3.8 update.

The verifier now handles that specific contract failure conservatively: after two invalid responses, all claims remain Unverified, source kinds remain Unknown, and the decision policy refuses to recommend an unsupported option. A regression test covers this path. The full local-Supabase browser suite subsequently passed **20/20** with real providers; the offline suite passed 312 tests, lint and TypeScript passed, and the production dependency audit found zero vulnerabilities. `npm audit fix` removed the fixable development advisories. Five development-only advisories remain on the `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces` chain; the published `braces` advisory lists no patched version as of 2026-10-05. The app does not accept user-supplied glob patterns through this lint tool.

The 2026-10-06 UI regression adds a browser test for submission progress based on saved stages, the clarification redirect and Czech profile preference. Normal browser coverage now passes 19 scenarios, with three paid-provider cases skipped; the offline suite passes 313 tests. The browser test verifies that clarification is shown only after the saved job reports `action_required`, rather than after an arbitrary timer.

The same day's audit found newly published advisories for `sharp` and `source-map-js`. A compatible `npm audit fix` updated the lockfile; the production dependency audit again reports zero vulnerabilities. The five existing development-only `braces`-chain findings remain upstream.
