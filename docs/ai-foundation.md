# Phase 4 — AI Foundation

Later phases add Options/Tasks and web orchestration. Phase 8 extends planning-agent inputs with optional structured `userResponses`, treated as unverified user context; output contracts remain unchanged.

Six independent server-only agents are implemented and tested: Intake, Planner, Researcher, Verifier, Critic, and Decision. This phase does not connect them into an orchestrator, write their results to Supabase, expose an AI API route, or activate AI in the web demo. Phase 5 requires a separate instruction.

## Configuration

Set `NEBIUS_API_KEY` in the ignored `.env.local` file. Optional server-only settings:

```dotenv
NEBIUS_BASE_URL=https://api.tokenfactory.us-central1.nebius.com/v1
NEBIUS_MODEL=nvidia/nemotron-3-super-120b-a12b
TAVILY_API_KEY=your-search-provider-key
```

The default NVIDIA model and regional endpoint follow the [official Nebius Nemotron example](https://github.com/nebius/token-factory-cookbook/blob/main/models/nemotron/nemotron3-super-120B.md). The generic `https://api.tokenfactory.nebius.com/v1` endpoint is also allowed. Model IDs can be overridden without changing agent code. Availability and account access must be confirmed with a live request. Configuration is read when creating a provider, so missing AI credentials do not break unrelated authentication or demo pages.

The adapter uses [Nebius chat completions](https://docs.tokenfactory.nebius.com/api-reference/inference/create-chat-completion) and [JSON schema output](https://docs.tokenfactory.nebius.com/ai-models-inference/json). The real search adapter uses [Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search). No new SDK is required: the implementation uses server-side fetch and Zod.

## Server-side usage

```typescript
import { intake, researcher } from "@/lib/ai/agents";
import { createNebiusProvider } from "@/lib/ai/nebius";
import { createTavilyProvider } from "@/lib/ai/research";

const ai = createNebiusProvider();
const result = await intake(
  { description: "Help me plan a community event for 20 people with a EUR 500 budget." },
  { ai },
);
// result.output is typed and validated. This call does not save a problem.

const research = await researcher(
  { question: "What does the venue publish about its capacity?" },
  { ai, research: createTavilyProvider() },
);
// Resolve source references through research.sources using claim.sourceIds.
```

Future HTTP/server-action callers must authenticate, authorize the problem owner, and add durable quotas before exposing these functions to users. The current functions are internal primitives and have no public request surface.

## Contracts and integrity

`schemas.ts` defines strict bounded input/output contracts and inferred TypeScript types. `agents.ts` provides named functions and a typed `runAgent` dispatcher. Each invocation validates its input before I/O, performs one model request, validates the returned JSON, then checks references. Results include agent name, configured model ID, validated output, and search sources when applicable.

- Intake separates supplied facts, assumptions, constraints, and unknowns.
- Planner produces a bounded acyclic dependency graph with priorities, research questions, and user questions. Duplicate, missing, self-referencing, and cyclic step references fail validation.
- Researcher calls the injected search provider before reasoning. Tavily is configured for five basic results, without an AI answer or automatic paid search-depth selection. Source IDs and retrieval times are assigned by application code. Duplicate URLs are removed and excerpts are bounded. The model can cite only supplied IDs; source URLs come from the search response. Empty search results can produce limitations but no sourced claims. Missing or failed search never falls back to model memory.
- Verifier covers every claim exactly once, records source quality, freshness, contradictions, and a public summary. `VERIFIED`, `PARTIALLY_VERIFIED`, and `CONFLICTING` require sources; conflicting results require multiple sources and an explanation of the contradiction.
- Critic reviews constraints, assumptions, evidence weaknesses, risks, failure cases, and alternatives independently. It is instructed to challenge the plan without inventing objections as facts.
- Decision selects a supplied option or abstains. References must exist in the supplied context. High confidence requires a selected option, evidence associated with verified claims, and no remaining output assumptions or unknowns.

Reference/schema checks prevent structural fabrication, not all factual hallucination. Verification statuses are model assessments of supplied excerpts, not an independent guarantee of truth. Search retrieval time is never treated as publication time. No arbitrary source URLs are fetched by the application. Sources and other model outputs are explicitly treated as untrusted data in system instructions. There are no executable agent tools.

## Failure and resource limits

Each agent has a 90-second overall deadline, including search and model work; Nebius requests have a 60-second deadline and Tavily a 20-second deadline. Caller cancellation propagates to requests. A promise deadline also rejects injected providers that ignore abort. Each invocation has at most one search and one model request, with no retries, repair loops, or fallback models. Model output is capped at 8,192 tokens; JSON HTTP bodies are streamed with a 512,000-byte limit. Input contracts and a 100,000-character serialized input cap bound context.

`AIError` exposes only stable error codes: configuration, invalid input/output, timeout, cancellation, authentication, rate limit, provider failure, refusal, and truncation. Provider bodies, keys, prompts, and reasoning fields are not included in errors or logs. Truncated, refused, malformed, or referentially invalid outputs fail closed. The provider response's private reasoning fields are discarded; only schema-defined public summaries are returned.

## Verification

```powershell
npm test
npm run lint
npm run typecheck
npm run build
# Explicit opt-in: incurs real model API usage with fictional test inputs.
npm run test:ai:live
```

Normal tests use injected responses and never contact AI/search services. The opt-in live suite invokes all six agents independently through the actual configured Nebius model. Its Researcher case supplies a clearly labeled fictional search fixture to isolate model reasoning from retrieval. A separate live Tavily retrieval check runs only when `TAVILY_API_KEY` is set. Tests do not log raw completions or credentials.

Verified on 2026-09-09: 130 offline tests passed; all six live agent calls passed using the default NVIDIA Nemotron model and regional Nebius endpoint. The live Tavily check was skipped because its key was not configured. This verifies real model connectivity and output/reference contracts, not a comprehensive quality benchmark across real-world problems.
