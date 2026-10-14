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
it("retries a truncated final artifact with a compact answer instruction", async () => {
  const deps = dependencies(outputs.tasks);
  deps.ai.generate.mockRejectedValueOnce(new AIError("TRUNCATED")).mockResolvedValueOnce(outputs.tasks);
  await expect(runAgent("tasks", inputs.tasks, deps)).resolves.toMatchObject({ output: outputs.tasks });
  expect(deps.ai.generate.mock.calls[1][0].instructions).toContain("too long and was cut off");
});
it("requests Czech user-facing output without translating evidence identifiers", async () => {
  const deps = dependencies(outputs.intake);
  await runAgent("intake", inputs.intake, deps, { responseLanguage: "cs" });
  expect(deps.ai.generate.mock.calls[0][0].instructions).toContain("Write user-facing titles, explanations, questions, recommendations and tasks in Czech");
  expect(deps.ai.generate.mock.calls[0][0].instructions).toContain("Preserve exact source quotations, source IDs");
});
it("requires the actual solution when intake identifies a deliverable", async () => {
  const input = { ...inputs.tasks, problem: { ...inputs.tasks.problem, requestedOutcome: "A written invitation" } };
  const incomplete = dependencies({ tasks: outputs.tasks.tasks });
  await expect(runAgent("tasks", input, incomplete)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  const complete = dependencies({ ...outputs.tasks, solution: { title: "Invitation", content: "Please join us for the community event. We will confirm the date and location before sending this invitation." } });
  await expect(runAgent("tasks", input, complete)).resolves.toMatchObject({ output: { solution: { title: "Invitation" } } });
});
it("normalizes escaped solution line breaks before showing the artifact", async () => {
  const value = { ...outputs.tasks, solution: { title: "Steps", content: "First item.&#10;Second item./n1. Then inspect the result.<br>Final check.%nReady.¶nDone." } };
  const result = await runAgent("tasks", inputs.tasks, dependencies(value));
  expect(result.output.solution?.content).toBe("First item.\nSecond item.\n1. Then inspect the result.\nFinal check.\nReady.\nDone.");
});
it("repairs common email and inline-list line breaks", async () => {
  const email = { ...inputs.tasks, problem: { ...inputs.tasks.problem, originalRequest: "Please write an email to Lucie about the delayed materials and sign it Martin." } };
  const value = { ...outputs.tasks, solution: { title: "Email", content: "Subject: Materials update nDear Lucie,/nI will send them Thursday. nKind regards, nMartin" } };
  const result = await runAgent("tasks", email, dependencies(value));
  expect(result.output.solution?.content.split("\n").length).toBeGreaterThan(2);
  const list = { ...outputs.tasks, solution: { title: "Summary", content: "1) Monday done. 2) Wednesday review. 3) Friday send." } };
  expect((await runAgent("tasks", inputs.tasks, dependencies(list))).output.solution?.content).toBe("1) Monday done.\n2) Wednesday review.\n3) Friday send.");
  const summary = { ...inputs.tasks, problem: { ...inputs.tasks.problem, originalRequest: "Shrň tyto poznámky do tří bodů pro tým." } };
  const prose = { ...outputs.tasks, solution: { title: "Shrnutí", content: "V pondělí jsme dokončili návrh. Ve středu proběhne kontrola. V pátek odešleme finální verzi." } };
  expect((await runAgent("tasks", summary, dependencies(prose))).output.solution?.content).toBe("- V pondělí jsme dokončili návrh.\n- Ve středu proběhne kontrola.\n- V pátek odešleme finální verzi.");
});
it("requires a useful plan and a next step when a safe decision is unavailable", async () => {
  const input = { ...inputs.tasks, decision: { ...inputs.tasks.decision, selectedOptionId: null }, evidenceGaps: ["Venue price is not verified"] };
  const missing = dependencies({ tasks: [] });
  await expect(runAgent("tasks", input, missing)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  const complete = dependencies({ solution: { title: "Verify the venue", content: "The venue cost is unknown. Request a written quote and compare it with the EUR 500 limit before booking." }, tasks: [{ ...outputs.tasks.tasks[0], optionId: null }] });
  await expect(runAgent("tasks", input, complete)).resolves.toMatchObject({ output: { solution: { title: "Verify the venue" } } });
});
it("accepts a finished source-free artifact without follow-through tasks after abstention", async () => {
  const input = { ...inputs.tasks,
    plan: { steps: [{ ...inputs.tasks.plan.steps[0], researchQuestions: [] }] },
    decision: { ...inputs.tasks.decision, selectedOptionId: null },
  };
  const complete = dependencies({ solution: { title: "Draft email", content: "Dear Lucie, I apologize for the delay. I will send the materials by Thursday at 15:00. Kind regards, Martin." }, tasks: [] });
  await expect(runAgent("tasks", input, complete, { sourceFreeDraft: true })).resolves.toMatchObject({ output: { tasks: [] } });
});
it("rejects a weekly solution that omits periods already present in the plan", async () => {
  const input = { ...inputs.tasks, problem: { ...inputs.tasks.problem, requestedOutcome: "A two-week schedule" }, plan: { steps: [
    { ...inputs.tasks.plan.steps[0], title: "Week 1: preparation" },
    { ...inputs.tasks.plan.steps[0], id: "step-2", title: "Week 2: rehearsal", dependencies: ["step-1"] },
  ] } };
  const missing = dependencies({ ...outputs.tasks, solution: { title: "Schedule", content: "Week 1: prepare materials and practise each day; the rest follows in the plan." } });
  await expect(runAgent("tasks", input, missing)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  const complete = dependencies({ ...outputs.tasks, solution: { title: "Schedule", content: "Week 1: prepare materials and practise daily. Week 2: rehearse twice and review mistakes." } });
  await expect(runAgent("tasks", input, complete)).resolves.toMatchObject({ output: { solution: { title: "Schedule" } } });
});
it("rejects a daily schedule whose stated blocks exceed the available minutes", async () => {
  const tooLong = dependencies({ ...outputs.tasks, solution: { title: "Study day", content: "Den 1 (sobota): 180 min – 2×30 min opakování, 6×30 min nové učivo. Další den odpočinek." } });
  await expect(runAgent("tasks", inputs.tasks, tooLong)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  const fits = dependencies({ ...outputs.tasks, solution: { title: "Study day", content: "Den 1 (sobota): 180 min – 2×30 min opakování, 4×30 min nové učivo. Další den odpočinek." } });
  await expect(runAgent("tasks", inputs.tasks, fits)).resolves.toMatchObject({ output: { solution: { title: "Study day" } } });
});
it("rejects an extra study block after a full three-hour day", async () => {
  const input = { ...inputs.tasks, problem: { ...inputs.tasks.problem, originalRequest: "I have 3 h on Saturday. Prepare a study schedule." } };
  const over = dependencies({ ...outputs.tasks, solution: { title: "Saturday", content: "Saturday: 3 h – medieval history plus 30 min review of antiquity after the main block." } });
  await expect(runAgent("tasks", input, over)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
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
it("caps source-free decisions at low confidence without discarding a valid selection", async () => {
  const input = { ...inputs.decision, sources: [], claims: [], verification: { assessments: [], sourceProfiles: [] } };
  const selected = { ...outputs.decision, confidence: "high" as const, supportingEvidence: ["invented"], rejectedAlternatives: [{ optionId: "invented-option", reason: "Not in the generated options" }] };
  const result = await runAgent("decision", input, dependencies(selected));
  expect(result.output.selectedOptionId).toBe(selected.selectedOptionId);
  expect(result.output.confidence).toBe("low");
  expect(result.output.supportingEvidence).toEqual([]);
  expect(result.output.rejectedAlternatives).toEqual([]);
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
