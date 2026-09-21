import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { runFullWorkflow } from "@/lib/orchestration/full";
import { fullStates, parseFullSnapshot } from "@/lib/orchestration/full-state";
import { runAgent } from "@/lib/ai/agents";
import { AIError } from "@/lib/ai/errors";
import { MemoryFullStore, fullDependencies } from "./fixtures/full-workflow";
import { workflowRequest } from "./fixtures/workflow";
import { inputs, outputs } from "./fixtures/ai";

afterEach(() => vi.useRealTimers());
const names = ["intake", "planner", "researcher", "verifier", "options", "critic", "decision", "tasks"];
it("runs all eight stages in order with actual upstream data and durable checkpoint handoff", async () => {
  const store = new MemoryFullStore(); const deps = fullDependencies(); const request = workflowRequest();
  const generate = deps.ai.generate.getMockImplementation()!;
  deps.ai.generate.mockImplementation(async (request) => {
    expect(store.history.at(-1)?.state).toBe(fullStates[names.indexOf(request.name) + 1]);
    return generate(request);
  });
  const result = await runFullWorkflow(request, store, deps);
  expect(result.state).toBe("COMPLETED"); expect(result.revision).toBe(9);
  expect(store.history.map((item) => item.state)).toEqual(fullStates);
  expect(deps.ai.generate.mock.calls.map(([request]) => request.name)).toEqual(names);
  expect(deps.research.search).toHaveBeenCalledTimes(1);
  expect(deps.research.search.mock.calls[0]?.[0]).toBe(outputs.planner.steps[0].researchQuestions[0]);
  expect(deps.ai.generate.mock.calls[4][0].input).toMatchObject({ claims: outputs.researcher.claims, verification: outputs.verifier });
  expect(deps.ai.generate.mock.calls[6][0].input).toMatchObject({ options: outputs.options.options, critique: outputs.critic });
  expect(deps.ai.generate.mock.calls[7][0].input).toMatchObject({ decision: result.decision });
  expect(result.tasks?.tasks.every((item) => item.status === "proposed")).toBe(true);
  expect(await store.load(request.runId)).toEqual(result);
});
it("researches the first three distinct priority questions and records incomplete coverage",async()=>{
  const deps=fullDependencies(); const original=deps.ai.generate.getMockImplementation()!;
  const questions=["official capacity documentation","official pricing documentation","official accessibility documentation","official cancellation documentation"];
  deps.ai.generate.mockImplementation(async(request)=>request.name==="planner" ? { steps:[{ ...outputs.planner.steps[0],researchQuestions:questions }] } : original(request));
  const result=await runFullWorkflow(workflowRequest(),new MemoryFullStore(),deps);
  expect(deps.research.search.mock.calls.map(([question])=>question)).toEqual(questions.slice(0,3));
  expect(result.research?.questions).toEqual(questions.slice(0,3));
  expect(result.research?.question).toContain("1. official capacity documentation");
  const decisionCall=deps.ai.generate.mock.calls.find(([request])=>request.name==="decision")?.[0];
  expect(decisionCall?.input).toMatchObject({ risks:expect.arrayContaining(["Research covered 3 of 4 planned questions; the remaining questions still require review."]) });
});
it.each(names)("halts and preserves earlier outputs when %s fails", async (name) => {
  const store = new MemoryFullStore(); const deps = fullDependencies();
  const generate = deps.ai.generate.getMockImplementation()!;
  deps.ai.generate.mockImplementation(async (request) => { if (request.name === name) throw new AIError("RATE_LIMIT"); return generate(request); });
  const result = await runFullWorkflow(workflowRequest(), store, deps);
  expect(result).toMatchObject({ state: "FAILED", error: "RATE_LIMIT" });
  expect(deps.ai.generate).toHaveBeenCalledTimes(names.indexOf(name) + 1);
});
it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])("stops after ambiguous write %i without retry or further model calls", async (revision) => {
  const store = new MemoryFullStore(); const deps = fullDependencies(); const original = store.save.bind(store);
  const save = vi.spyOn(store, "save").mockImplementation(async (value, expected) => { if (expected === revision) throw new Error("private DB error"); return original(value, expected); });
  await expect(runFullWorkflow(workflowRequest(), store, deps)).rejects.toMatchObject({ code: "PERSISTENCE" });
  expect(save).toHaveBeenCalledTimes(revision + 1); expect(deps.ai.generate).toHaveBeenCalledTimes(revision);
});
it("requires search before spending tokens and stops on search failure", async () => {
  const deps = fullDependencies(); const store = new MemoryFullStore();
  await expect(runFullWorkflow(workflowRequest(), store, { ai: deps.ai })).rejects.toMatchObject({ code: "CONFIGURATION" });
  expect(deps.ai.generate).not.toHaveBeenCalled();
  deps.research.search.mockRejectedValue(new AIError("AUTHENTICATION"));
  expect(await runFullWorkflow(workflowRequest(), store, deps)).toMatchObject({ state: "FAILED", error: "AUTHENTICATION" });
  expect(deps.ai.generate).toHaveBeenCalledTimes(2);
});
it("can finish with no evidence, no viable option and no proposed tasks without inventing results", async () => {
  const deps = fullDependencies(); const generate = deps.ai.generate.getMockImplementation()!;
  deps.research.search.mockResolvedValue([]);
  deps.ai.generate.mockImplementation(async (request) => {
    if (request.name === "researcher") return { summary: "No evidence found", claims: [], limitations: ["No search results"] };
    if (request.name === "verifier") return { assessments: [] };
    if (request.name === "options") return { options: [], limitations: ["Insufficient information"] };
    if (request.name === "decision") return { ...outputs.decision, selectedOptionId: null, supportingEvidence: [], confidence: "low" };
    if (request.name === "tasks") return { tasks: [] };
    return generate(request);
  });
  const result = await runFullWorkflow(workflowRequest(), new MemoryFullStore(), deps);
  expect(result.state).toBe("COMPLETED"); expect(result.decision?.selectedOptionId).toBeNull();
  expect(result.decision?.supportingEvidence).toEqual([]); expect(result.tasks?.tasks).toEqual([]);
});
it("abstains deterministically when no claim has a grounded supporting excerpt", async () => {
  const deps = fullDependencies(); const generate = deps.ai.generate.getMockImplementation()!;
  deps.ai.generate.mockImplementation(async (request) => {
    if (request.name === "verifier") return { ...outputs.verifier, assessments: outputs.verifier.assessments.map((item) => ({ ...item, supportingQuotes: [] })) };
    if (request.name === "tasks") return { tasks: [{ ...outputs.tasks.tasks[0], optionId: null }] };
    return generate(request);
  });
  const result = await runFullWorkflow(workflowRequest(), new MemoryFullStore(), deps);
  expect(result).toMatchObject({ state: "COMPLETED", qualityPolicy: 2, decision: { selectedOptionId: null, confidence: "low", supportingEvidence: [] } });
  expect(result.decision?.recommendation).toContain("no traceable verified supporting excerpt");
  expect(result.tasks?.tasks[0].optionId).toBeNull();
  expect(() => parseFullSnapshot({ ...result, decision: { ...result.decision, selectedOptionId: outputs.options.options[0].id } })).toThrow("INVALID_CHECKPOINT");
});
it("does not rerun completed IDs or accept inconsistent persisted states", async () => {
  const deps = fullDependencies(); const store = new MemoryFullStore(); const request = workflowRequest();
  const result = await runFullWorkflow(request, store, deps);
  await expect(runFullWorkflow(request, store, deps)).rejects.toMatchObject({ code: "CONFLICT" });
  for (const patch of [{ revision: 1 }, { verification: null }, { tasks: { tasks: [{ ...outputs.tasks.tasks[0], optionId: "invented" }] } }]) expect(() => parseFullSnapshot({ ...result, ...patch })).toThrow("INVALID_CHECKPOINT");
});
it("cancels during search without moving to verification", async () => {
  const deps = fullDependencies(); const controller = new AbortController();
  deps.research.search.mockImplementation(async () => { controller.abort(); return new Promise(() => {}); });
  expect(await runFullWorkflow(workflowRequest(), new MemoryFullStore(), deps, { signal: controller.signal })).toMatchObject({ state: "CANCELLED" });
  expect(deps.ai.generate).toHaveBeenCalledTimes(2);
});
it("enforces a deadline during task generation", async () => {
  vi.useFakeTimers(); const deps = fullDependencies(); const generate = deps.ai.generate.getMockImplementation()!;
  deps.ai.generate.mockImplementation(async (request) => request.name === "tasks" ? new Promise(() => {}) : generate(request));
  const pending = runFullWorkflow(workflowRequest(), new MemoryFullStore(), deps);
  await vi.advanceTimersByTimeAsync(90_001);
  expect(await pending).toMatchObject({ state: "FAILED", error: "TIMEOUT" });
});
it("recovers from the last durable checkpoint without rerunning completed agents", async () => {
  const store = new MemoryFullStore(); const first = fullDependencies(); const request = workflowRequest();
  first.research.search.mockRejectedValueOnce(new AIError("TIMEOUT"));
  await expect(runFullWorkflow(request, store, first, { preserveInterrupt: true })).rejects.toMatchObject({ code: "TIMEOUT" });
  expect(store.history.at(-1)?.state).toBe("RESEARCH");
  const resumed = fullDependencies();
  const result = await runFullWorkflow(request, store, resumed, { recover: true, preserveInterrupt: true });
  expect(result.state).toBe("COMPLETED");
  expect(resumed.ai.generate.mock.calls.map(([value]) => value.name)).toEqual(["researcher", "verifier", "options", "critic", "decision", "tasks"]);
});
it("rejects duplicate options, task cycles, foreign references and completed task claims", async () => {
  const deps = fullDependencies();
  deps.ai.generate.mockResolvedValue({ options: [outputs.options.options[0], outputs.options.options[0]], limitations: [] });
  await expect(runAgent("options", inputs.options, deps)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  for (const patch of [{ dependencies: ["task-1"] }, { planStepId: "invented" }, { optionId: "invented" }, { status: "completed" }]) {
    deps.ai.generate.mockResolvedValue({ tasks: [{ ...outputs.tasks.tasks[0], ...patch }] });
    await expect(runAgent("tasks", inputs.tasks, deps)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  }
});
