# Title

Avenli

## One-line Summary

Avenli turns complex real-world problems into researched, reviewable action plans while keeping people in control of every external action.

## Problem

Complex personal and work decisions rarely fail because people cannot generate another list of ideas. They fail because goals, constraints, unknowns, web research, trade-offs and next steps are scattered across tools. A chat answer also disappears easily, mixes supported facts with assumptions and can move too quickly from a suggestion to a real-world action.

Avenli is for people who need to make a consequential decision or coordinate a multi-step outcome and want to understand the evidence, limits and reasoning behind the recommendation.

## Solution

Avenli is a durable AI problem-solving workspace. A user describes an outcome, deadline, constraints and unknowns. A finite eight-stage workflow turns that input into a structured goal, research plan, bounded web evidence, verified claims, compared options, an adversarial critique, a citation-aware recommendation and proposed tasks.

The workflow pauses when it needs personal context, survives reloads and interrupted requests, and resumes from validated checkpoints. Results remain inspectable instead of collapsing into one chat message. Tasks can be tracked, unresolved questions can start a separate focused analysis, and a completed problem can be monitored for a specific changed condition.

External actions are deliberately isolated from analysis. The implemented Google Calendar path first requests the narrow permission, then displays the exact event payload, requires a separate approval and records an audit trail. Agents themselves have no executable tools.

## Why This Matters

A useful AI assistant should help a person reach a defensible outcome without hiding uncertainty or quietly acting on their behalf. Avenli makes the evidence, remaining unknowns, assumptions, risks and action boundary visible. This is especially useful for time-bounded decisions such as launches, purchases, travel changes, relocations and work projects where the quality of the process matters as much as the final suggestion.

The product demonstrates that open-model reasoning can power a coherent consumer workflow rather than only a technical chat demo. It combines durable state, human clarification, bounded research and explicit action approval in one responsive web application.

## How We Used AI

Avenli uses the NVIDIA `nvidia/nemotron-3-super-120b-a12b` open model through the Nebius Token Factory OpenAI-compatible inference API. Nemotron is the core runtime of eight typed stages:

1. Intake extracts the goal, constraints, assumptions and unknowns.
2. Planner creates a bounded dependency graph and separates public research questions from questions only the user can answer.
3. Researcher analyzes bounded Tavily excerpts as untrusted input.
4. Verifier checks every claim against supplied source IDs, excerpts, source quality, freshness and contradictions.
5. Options generates realistic alternatives grounded in the verified record.
6. Critic stress-tests the options and surfaces failure modes.
7. Decision recommends one supplied option or abstains, with conservative confidence and source references.
8. Tasks turns the selected direction into proposed next steps without executing them.

We chose Nemotron 3 Super because the product needs strong instruction following and structured reasoning across several specialized stages while remaining practical for repeated calls in an interactive workflow. Every response must pass a Zod schema and cross-stage reference checks. Invalid read-only output gets at most one repair generation with the same validated input and evidence; timeouts, provider failures and safety refusals are not retried automatically.

Tavily makes functional runtime search calls for up to three priority questions. Avenli canonicalizes and deduplicates results, bounds the evidence set and keeps retrieved text outside system instructions. The model may cite only application-assigned source IDs.

## How We Used Codex

Codex was the implementation partner throughout the project. Starting from the product plan, it helped translate requirements into a Next.js/Supabase architecture, implement database migrations and row-level security, build the checkpointed eight-agent orchestrator, integrate Nebius, Tavily and Google OAuth, and turn the visual references into the responsive Avenli interface.

Codex also generated and refined the regression suite, traced contract failures found by live model evaluations, hardened prompt-injection and authorization boundaries, diagnosed hosted configuration issues, verified Supabase migrations, deployed releases to Vercel and performed production smoke checks. The user made product, scope, service, privacy and release decisions; Codex carried those decisions through code, tests, documentation and deployment.

## Key Features

- Finite, checkpointed eight-agent workflow powered by NVIDIA Nemotron on Nebius Token Factory.
- Bounded Tavily research with canonical sources, excerpt traceability, freshness review and incomplete-coverage warnings.
- Human clarification that pauses before research and resumes the same saved run.
- Explicit unknowns, assumptions, critic findings, risks and conservative confidence.
- Persistent task progress, due dates, reminders, solved/reopened lifecycle and focused follow-up analyses.
- Daily condition monitoring that returns a problem for human review only when current evidence supports the saved condition.
- Optional Google Calendar and Gmail context controlled independently in Settings.
- Review-first Google Calendar event creation with narrow permission, exact payload approval, idempotency and an audit log.
- Email/password and Google authentication, account export/deletion, analytics opt-out and encrypted integration credentials.
- Public no-account demo with fictional data and no provider, database or external-service calls.
- Responsive production interface for desktop and mobile.

## Architecture

The browser communicates with authenticated Next.js 16 server routes hosted on Vercel. Supabase Auth establishes identity and Supabase Postgres stores owner-scoped product data, revisions, checkpoints, notifications, integrations and action audits behind row-level security.

The server orchestrator calls Nemotron through Nebius Token Factory and Tavily through a bounded research adapter. It saves a validated checkpoint before starting each next stage. System prompts label user text, retrieved excerpts and upstream model output as untrusted data. Strict schemas and reference checks reject invented sources, options, steps and task dependencies.

External writes use separate authenticated routes. Google credentials are encrypted outside the public schema, service reads can be switched off independently and Calendar writes require a visible proposal plus explicit approval. See `docs/architecture.md` for the diagram and trust boundaries.

## Testing Instructions

### Fast judge path

1. Open <https://avenli.vercel.app/demo>.
2. Open a fictional problem and inspect Overview, Research, Options and Tasks.
3. Resize to a mobile viewport to verify the responsive navigation and internally scrolling comparison table.
4. Open <https://avenli.vercel.app> and create an account if you want to run a saved analysis. Provider-backed runs use production services and may pause for clarification.

### Local setup

1. Install Node.js 24 or newer and Docker Desktop with Linux containers.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and provide local Supabase public configuration plus server-only Nebius and Tavily keys.
4. Run `npm run db:start` and apply the documented migrations.
5. Run `npm run dev`, then open `http://127.0.0.1:3000`.

### Verification commands

```text
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm audit --omit=dev
```

The current release passes 311 offline tests across 50 files, zero-warning lint, strict TypeScript, the optimized production build, 17 normal Chromium scenarios and a zero-known-vulnerability production dependency audit. Three complete in-memory quality scenarios have also exercised real Nemotron/Nebius and Tavily calls. Three opt-in local-Supabase browser scenarios are excluded from the normal suite because they create disposable accounts and incur provider usage.

## Public Demo Link

<https://avenli.vercel.app>

No-account fictional workspace: <https://avenli.vercel.app/demo>

## Public Repository Link

TODO before final review: make <https://github.com/jkaczmarczyk96-code/resolve> public after the final committed-secret scan. It is intentionally private during preparation.

## Demo Video

Public YouTube demo: <https://youtu.be/B1Aqo6qaYtc>. The 2:34 H.264/AAC demo has locally generated English narration and synchronized captions. The owner approved public upload on 2026-09-23, and YouTube Studio confirmed publication with no copyright issues. Upload metadata is recorded in `docs/youtube-demo.md`.

Planned flow:

- 0:00–0:17 — problem and product promise.
- 0:17–0:38 — signed-in workflow and distinction from the fictional public demo.
- 0:38–1:02 — eight Nemotron stages through Nebius Token Factory.
- 1:02–1:36 — research evidence and the demo's zero traceable claims.
- 1:36–1:53 — human clarification and durable workflow.
- 1:53–2:13 — the fictional Calendar proposal and real approval boundary.
- 2:13–2:34 — architecture boundaries and close.
- 2:50–3:00 — close on the recommendation and production URL.

The ready-to-read voiceover is in `docs/demo-narration.md`.

## Screenshot Shot List

Checked in and regenerated for the current release:

1. `docs/screenshots/devpost-cover.png` — 1200×630 cover image.
2. `docs/screenshots/devpost-thumbnail.png` — square submission thumbnail.
3. `docs/screenshots/landing.png` — product promise and Avenli identity.
4. `docs/screenshots/workspace-desktop.png` — desktop problem workspace.
5. `docs/screenshots/workspace-mobile.png` — responsive comparison and mobile navigation.

Captured from the production public demo without account data:

6. `docs/screenshots/research-evidence.png` — Research tab with deterministic evidence quality visible.
7. `docs/screenshots/calendar-approval.png` — Calendar proposal at the separate approval boundary.

Both views were visually checked after export and neither performs a live provider or external-service call.

## Submission Readiness Notes

- Production deployment: ready at <https://avenli.vercel.app>.
- Recommended track: Best apps and agents.
- Tavily eligibility: yes; the runtime makes functional Tavily API calls.
- License: MIT.
- Devpost registration: confirmed through the live Devpost account.
- Repository: private until the final secret scan and explicit public-release step.
- Video: private draft ready; reviewed public URL missing.
- Final privacy-safe production screenshots: ready.
- Final Devpost payload review and explicit submit confirmation: pending.

## Known Limitations

- Research is deliberately bounded to three priority questions and ten deduplicated excerpts per analysis, so Avenli exposes incomplete coverage rather than claiming exhaustive research.
- Model outputs can still be wrong. Strict contracts and evidence checks reduce structural fabrication but do not independently prove every factual claim; Avenli may abstain or cap confidence.
- The production worker is designed for Vercel Hobby limits and may checkpoint and resume rather than finish a long run in one request.
- Daily monitoring is bounded and does not continuously watch every result.
- Gmail uses a restricted Google scope and remains limited to the configured tester allowlist while public verification requirements are evaluated.
- Google Calendar is the only implemented write action, and it always requires explicit review and approval.
- The three local-Supabase live browser scenarios are currently blocked on this Windows machine by a Docker Desktop socket failure; hosted Supabase migrations, lint, production health and real provider workflows were verified separately.

## TODO Official Form Fields

Official requirements rechecked on Devpost on 2026-09-22. These are draft answers only and must be reviewed before the final submit step.

- **Submitter Type:** Individual
- **Organization Name:** N/A
- **Submitter Country of Residence:** TODO — confirm the exact Devpost option.
- **Canadian province:** N/A, provided the confirmed residence is outside Canada.
- **Track:** Best apps and agents
- **New or existing before August 26, 2026:** New
- **Public repository:** `https://github.com/jkaczmarczyk96-code/resolve` — currently private; make public only at final release.
- **Working demo:** `https://avenli.vercel.app`
- **Model and variant:** NVIDIA `nvidia/nemotron-3-super-120b-a12b` via Nebius Token Factory; rationale is documented in **How We Used AI**.
- **Nemotron output quality (1–10):** Proposed **8/10** — it followed complex role-specific JSON contracts well across repeated eight-stage runs. Live evaluation still exposed one invalid-output repair and unsupported verification labels, which the application now catches and downgrades deterministically.
- **Prompt engineering or fine-tuning:** Prompt-engineered, no fine-tuning. Eight role-specific system contracts, strict structured outputs, untrusted-data boundaries, evidence references and one narrowly scoped invalid-output repair.
- **Comparison with other models:** No controlled competitor benchmark was run for this hackathon, so Avenli does not claim that Nemotron outperformed another model. It was evaluated against fixed schemas, reference-integrity rules and three complete live quality scenarios instead.
- **Most valuable Nebius capabilities:** Token Factory's hosted OpenAI-compatible access to Nemotron let the same typed provider and validation layer support all eight stages without operating GPU infrastructure. Configurable endpoint/model values made live development and deployment consistent.
- **Likelihood to recommend Nemotron on Nebius (1–10):** Proposed **8/10** — the hosted open-model endpoint supported the full workflow without GPU operations, while strict application-side validation remained necessary for production use.
- **Inference experience versus previous cloud/local environments (1–10):** Proposed **8/10** — the OpenAI-compatible API made integration and deployment straightforward. The main development cost was handling occasional latency and structurally valid responses that still violated cross-stage reference rules.
- **Requested Nebius improvement:** Draft for review — clearer per-model structured-output guidance and more granular request diagnostics would shorten debugging when a response is valid JSON but violates a cross-stage reference contract.
- **What to see next from Nemotron:** Draft for review — stronger reliable structured generation, transparent model-version stability and smaller variants optimized for low-latency agent stages.
- **Used Tavily:** Yes
- **Builders & Brews city:** leave blank unless applicable.
- **Age-of-majority checkbox:** TODO — user must confirm.
- **Promotion-entity employee checkbox:** TODO — user must confirm.
- **Demo video URL:** `https://youtu.be/B1Aqo6qaYtc`.
