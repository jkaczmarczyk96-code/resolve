import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { runBasicWorkflow } from "@/lib/orchestration/basic";
import { parseSnapshot, WorkflowError } from "@/lib/orchestration/state";
import { AIError } from "@/lib/ai/errors";
import type { GenerationRequest } from "@/lib/ai/provider";
import { outputs } from "./fixtures/ai";
import { MemoryWorkflowStore, workflowRequest } from "./fixtures/workflow";

const basicDecision = { ...outputs.decision, selectedOptionId: "proposed-plan", supportingEvidence: [], confidence: "medium" };
function dependencies() {
  return { ai: { model: "fixture-model", generate: vi.fn(async (request: GenerationRequest) => {
    if (request.name === "intake") return outputs.intake;
    if (request.name === "planner") return outputs.planner;
    if (request.name === "decision") return basicDecision;
    throw new Error("Unexpected agent");
  }) }, research: { search: vi.fn() } };
}
afterEach(() => vi.useRealTimers());
it("passes validated results through Intake → Plan → Decide and checkpoints before each call", async () => {
  const store = new MemoryWorkflowStore();
  const deps = dependencies();
  const generate = deps.ai.generate.getMockImplementation()!;
  deps.ai.generate.mockImplementation(async (request) => {
    expect(store.history.at(-1)?.state).toBe({ intake: "INTAKE", planner: "PLAN", decision: "DECIDE" }[request.name]);
    return generate(request);
  });
  const request = workflowRequest();
  const result = await runBasicWorkflow(request, store, deps);
  expect(result.state).toBe("COMPLETED");
  expect(result.revision).toBe(4);
  expect(result.decision?.confidence).toBe("low");
  expect(store.history.map((item) => item.state)).toEqual(["PENDING", "INTAKE", "PLAN", "DECIDE", "COMPLETED"]);
  expect(deps.ai.generate.mock.calls.map(([item]) => item.name)).toEqual(["intake", "planner", "decision"]);
  expect(deps.ai.generate.mock.calls[1][0].input).toEqual({ problem: outputs.intake });
  expect(deps.ai.generate.mock.calls[2][0].input).toMatchObject({ planningContext: { problem: outputs.intake, plan: outputs.planner }, critique: null, sources: [], claims: [], verification: { assessments: [] } });
  expect(deps.research.search).not.toHaveBeenCalled();
  expect(await store.load(request.runId)).toEqual(result);
});
it.each(["intake", "planner", "decision"])("persists %s failures and never runs a later agent", async (name) => {
  const store = new MemoryWorkflowStore();
  const deps = dependencies();
  const generate = deps.ai.generate.getMockImplementation()!;
  deps.ai.generate.mockImplementation(async (request) => {
    if (request.name === name) throw new AIError("RATE_LIMIT");
    return generate(request);
  });
  const result = await runBasicWorkflow(workflowRequest(), store, deps);
  expect(result.state).toBe("FAILED");
  expect(result.error).toBe("RATE_LIMIT");
  expect(deps.ai.generate).toHaveBeenCalledTimes(["intake", "planner", "decision"].indexOf(name) + 1);
});
it("stops on malformed output without saving it", async () => {
  const store = new MemoryWorkflowStore();
  const deps = dependencies();
  deps.ai.generate.mockResolvedValue({ secret: "not a valid result" } as never);
  const result = await runBasicWorkflow(workflowRequest(), store, deps);
  expect(result).toMatchObject({ state: "FAILED", error: "INVALID_OUTPUT", intake: null });
  expect(JSON.stringify(result)).not.toContain("secret");
});
it.each([0, 1, 2, 3])("stops on ambiguous persistence at revision %i without another write or call", async (revision) => {
  const store = new MemoryWorkflowStore();
  const deps = dependencies();
  const original = store.save.bind(store);
  const save = vi.spyOn(store, "save").mockImplementation(async (snapshot, expected) => {
    if (expected === revision) throw new Error("private database details");
    await original(snapshot, expected);
  });
  await expect(runBasicWorkflow(workflowRequest(), store, deps)).rejects.toMatchObject({ code: "PERSISTENCE" });
  expect(save).toHaveBeenCalledTimes(revision + 1);
  expect(deps.ai.generate).toHaveBeenCalledTimes(revision);
});
it("rejects a duplicate run ID before spending tokens again", async () => {
  const store = new MemoryWorkflowStore();
  const deps = dependencies();
  const request = workflowRequest();
  await runBasicWorkflow(request, store, deps);
  deps.ai.generate.mockClear();
  await expect(runBasicWorkflow(request, store, deps)).rejects.toMatchObject({ code: "CONFLICT" });
  expect(deps.ai.generate).not.toHaveBeenCalled();
});
it("rejects stale writers", async () => {
  const store = new MemoryWorkflowStore();
  await runBasicWorkflow(workflowRequest(), store, dependencies());
  await expect(store.save(store.history[2], 0)).rejects.toMatchObject({ code: "CONFLICT" });
});
it("persists cancellation during a running call", async () => {
  const store = new MemoryWorkflowStore();
  const controller = new AbortController();
  const deps = dependencies();
  deps.ai.generate.mockImplementation(async () => { controller.abort(); return new Promise(() => {}); });
  const result = await runBasicWorkflow(workflowRequest(), store, deps, { signal: controller.signal });
  expect(result).toMatchObject({ state: "CANCELLED", error: "CANCELLED" });
  expect(deps.ai.generate).toHaveBeenCalledTimes(1);
});
it("persists a deadline failure without looping", async () => {
  vi.useFakeTimers();
  const store = new MemoryWorkflowStore();
  const deps = dependencies();
  deps.ai.generate.mockImplementation(() => new Promise(() => {}));
  const pending = runBasicWorkflow(workflowRequest(), store, deps);
  await vi.advanceTimersByTimeAsync(90_001);
  expect(await pending).toMatchObject({ state: "FAILED", error: "TIMEOUT" });
  expect(deps.ai.generate).toHaveBeenCalledTimes(1);
});
it("rejects malformed persisted states and fabricated plan references", async () => {
  const store = new MemoryWorkflowStore();
  const result = await runBasicWorkflow(workflowRequest(), store, dependencies());
  for (const patch of [{ revision: 1 }, { intake: null }, { state: "PLAN" }, { decision: { ...result.decision, selectedOptionId: "invented" } }, { plan: { steps: [{ ...outputs.planner.steps[0], dependencies: ["missing"] }] } }]) {
    expect(() => parseSnapshot({ ...result, ...patch })).toThrow(WorkflowError);
  }
});
it("does not run a model when access or initial persistence fails", async () => {
  const store = new MemoryWorkflowStore();
  const deps = dependencies();
  vi.spyOn(store, "loadProblem").mockRejectedValue(new WorkflowError("NOT_FOUND"));
  await expect(runBasicWorkflow(workflowRequest(), store, deps)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(deps.ai.generate).not.toHaveBeenCalled();
  expect(store.history).toHaveLength(0);
});
