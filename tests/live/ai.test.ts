import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { runAgent } from "@/lib/ai/agents";
import { createNebiusProvider } from "@/lib/ai/nebius";
import { createTavilyProvider } from "@/lib/ai/research";
import type { AgentName } from "@/lib/ai/schemas";
import { inputs, sources } from "../fixtures/ai";

// Explicit opt-in command only. Each case invokes one real model, with independent fictional input.
const ai = createNebiusProvider();
it.each(Object.keys(inputs) as AgentName[])("live %s validates its output and reference integrity", async (name) => {
  const result = await runAgent(name, inputs[name], { ai, research: { search: async () => sources } });
  expect(result.agent).toBe(name);
  expect(result.model).toBe(ai.model);
  expect(result.output).toBeDefined();
});
it.skipIf(!process.env.TAVILY_API_KEY)("live search provider returns attributable results", async () => {
  const results = await createTavilyProvider().search("Nebius Token Factory structured output documentation", new AbortController().signal);
  expect(results.length).toBeGreaterThan(0);
  expect(results.every((source) => source.url.startsWith("https://") && source.content.length > 0)).toBe(true);
});
