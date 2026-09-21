import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { runAgent } from "@/lib/ai/agents";
import { AIError, bounded } from "@/lib/ai/errors";
import type { GenerationRequest } from "@/lib/ai/provider";
import type { AgentName } from "@/lib/ai/schemas";
import { inputs, outputs, sources } from "./fixtures/ai";

afterEach(() => vi.useRealTimers());
function dependencies(output: unknown) {
  return { ai: { model: "fixture-model", generate: vi.fn(async (request: GenerationRequest) => { void request; return output; }) }, research: { search: vi.fn(async () => sources) } };
}
describe.each(Object.keys(inputs) as AgentName[])("%s agent", (name) => {
  it("validates its independent input and structured output", async () => {
    const deps = dependencies(outputs[name]);
    const result = await runAgent(name, inputs[name], deps);
    expect(result.output).toEqual(outputs[name]);
    expect(deps.ai.generate).toHaveBeenCalledTimes(1);
    expect(deps.research.search).toHaveBeenCalledTimes(name === "researcher" ? 1 : 0);
    expect(result.sources).toEqual(name === "researcher" ? sources : []);
  });
  it("rejects invalid input before calling a provider", async () => {
    const deps = dependencies(outputs[name]);
    // Deliberately bypass compile-time validation to exercise runtime boundaries.
    await expect(runAgent(name, {} as never, deps)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(deps.ai.generate).not.toHaveBeenCalled();
  });
  it("rejects malformed output rather than passing it to another agent", async () => {
    const deps = dependencies({ fabricated: true });
    await expect(runAgent(name, inputs[name], deps)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    expect(deps.ai.generate).toHaveBeenCalledTimes(2);
  });
  it("has a bounded timeout even if an injected provider ignores abort", async () => {
    vi.useFakeTimers();
    const deps = dependencies(outputs[name]);
    deps.ai.generate = vi.fn(() => new Promise(() => {}));
    const pending = expect(runAgent(name, inputs[name], deps)).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(90_001);
    await pending;
  });
});
it("repairs one invalid read-only model response and validates the replacement", async () => {
  const deps = dependencies(outputs.intake);
  deps.ai.generate.mockRejectedValueOnce(new AIError("INVALID_OUTPUT")).mockResolvedValueOnce(outputs.intake);
  await expect(runAgent("intake", inputs.intake, deps)).resolves.toMatchObject({ output: outputs.intake });
  expect(deps.ai.generate).toHaveBeenCalledTimes(2);
  expect(deps.ai.generate.mock.calls[1][0].instructions).toContain("previous response was rejected");
});
it("rejects fabricated source IDs and model-generated URLs", async () => {
  await expect(runAgent("researcher", inputs.researcher, dependencies({ ...outputs.researcher, claims: [{ id: "c", statement: "Invented", sourceIds: ["invented-source"] }] }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  await expect(runAgent("researcher", inputs.researcher, dependencies({ ...outputs.researcher, sources: [{ url: "https://fake.example" }] }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
});
it("does not replace missing or failed search with model knowledge", async () => {
  const deps = dependencies(outputs.researcher);
  await expect(runAgent("researcher", inputs.researcher, { ai: deps.ai })).rejects.toMatchObject({ code: "CONFIGURATION" });
  deps.research.search.mockRejectedValue(new Error("secret provider body"));
  await expect(runAgent("researcher", inputs.researcher, deps)).rejects.toThrow("AI request failed: PROVIDER");
  expect(deps.ai.generate).not.toHaveBeenCalled();
});
it("allows empty research results only without sourced claims", async () => {
  const deps = dependencies({ summary: "No evidence found", claims: [], limitations: ["No sources"] });
  deps.research.search.mockResolvedValue([]);
  expect((await runAgent("researcher", inputs.researcher, deps)).sources).toEqual([]);
  deps.ai.generate.mockResolvedValue(outputs.researcher);
  await expect(runAgent("researcher", inputs.researcher, deps)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
});
it.each(["cycle", "unknown", "duplicate"])("rejects a %s in plan dependencies", async (kind) => {
  const step = outputs.planner.steps[0];
  const steps = kind === "cycle" ? [{ ...step, dependencies: ["step-2"] }, { ...step, id: "step-2", dependencies: [step.id] }] : kind === "unknown" ? [{ ...step, dependencies: ["missing"] }] : [step, step];
  await expect(runAgent("planner", inputs.planner, dependencies({ steps }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
});
it("requires exactly one assessment per claim", async () => {
  await expect(runAgent("verifier", inputs.verifier, dependencies({ assessments: [] }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
});
it("rejects verified claims with no sources", async () => {
  await expect(runAgent("verifier", inputs.verifier, dependencies({ assessments: [{ ...outputs.verifier.assessments[0], status: "VERIFIED", sourceIds: [] }] }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
});
it("rejects invented decisions and unsupported high confidence", async () => {
  for (const patch of [{ selectedOptionId: "invented" }, { confidence: "high" }, { supportingEvidence: ["invented"] }]) {
    await expect(runAgent("decision", inputs.decision, dependencies({ ...outputs.decision, ...patch }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  }
});
it("rejects invalid cross-agent evidence on input", async () => {
  const deps = dependencies(outputs.critic);
  await expect(runAgent("critic", { ...inputs.critic, sources: [] }, deps)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  expect(deps.ai.generate).not.toHaveBeenCalled();
});
it("cancels before work and during work without leaking errors", async () => {
  const controller = new AbortController();
  const pending = expect(bounded(() => new Promise(() => {}), 1000, controller.signal)).rejects.toMatchObject({ code: "CANCELLED" });
  controller.abort();
  await pending;
  const work = vi.fn();
  await expect(bounded(work, 1000, controller.signal)).rejects.toBeInstanceOf(AIError);
  expect(work).not.toHaveBeenCalled();
});
