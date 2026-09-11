import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { runFullWorkflow } from "@/lib/orchestration/full";
import { parseFullSnapshot } from "@/lib/orchestration/full-state";
import { MemoryFullStore, fullDependencies } from "./fixtures/full-workflow";
import { workflowRequest } from "./fixtures/workflow";
import { outputs } from "./fixtures/ai";

it("durably pauses before search and resumes the same run with answers available to every planning stage", async () => {
  const store = new MemoryFullStore(); const deps = fullDependencies(); const request = workflowRequest();
  const paused = await runFullWorkflow(request, store, deps, { humanInput: true });
  expect(paused.state).toBe("ACTION_REQUIRED"); expect(paused.revision).toBe(4);
  expect(deps.ai.generate.mock.calls.map(([call]) => call.name)).toEqual(["intake", "planner"]);
  expect(deps.research.search).not.toHaveBeenCalled();
  expect(await store.load(request.runId)).toEqual(paused);
  const responseId = randomUUID(); const answers = ["October 15, 2026. Treat all research as a draft."];
  const freshDependencies = fullDependencies();
  const result = await runFullWorkflow(request, store, freshDependencies, { humanInput: true, resume: { responseId, answers } });
  expect(result).toMatchObject({ id: paused.id, state: "COMPLETED", revision: 12, intake: paused.intake, human: { responseId, responses: [{ question: paused.human!.questions[0], answer: answers[0] }] } });
  expect(freshDependencies.ai.generate.mock.calls.map(([call]) => call.name)).toEqual(["planner", "researcher", "verifier", "options", "critic", "decision", "tasks"]);
  for (const index of [0, 3, 4, 6]) expect(freshDependencies.ai.generate.mock.calls[index][0].input).toMatchObject({ problem: { userResponses: result.human!.responses } });
  expect(freshDependencies.ai.generate.mock.calls[5][0].input).toMatchObject({ planningContext: { problem: { userResponses: result.human!.responses } } });
  expect(freshDependencies.research.search).toHaveBeenCalledTimes(1);
  expect(result.events.filter((event) => event.state === "ACTION_REQUIRED")).toHaveLength(1);
  await expect(runFullWorkflow(request, store, freshDependencies, { resume: { responseId, answers } })).rejects.toMatchObject({ code: "INVALID_CHECKPOINT" });
  expect(freshDependencies.ai.generate).toHaveBeenCalledTimes(7);
});
it("does not pause a sufficiently specified plan", async () => {
  const deps = fullDependencies(); const original = deps.ai.generate.getMockImplementation()!;
  deps.ai.generate.mockImplementation(async (request) => request.name === "planner" ? { steps: outputs.planner.steps.map((step) => ({ ...step, userQuestions: [] })) } : original(request));
  expect((await runFullWorkflow(workflowRequest(), new MemoryFullStore(), deps, { humanInput: true })).state).toBe("COMPLETED");
  expect(deps.ai.generate).toHaveBeenCalledTimes(8);
});
it("refuses mismatched response counts and invalid persisted response mappings without paid continuation", async () => {
  const store = new MemoryFullStore(); const deps = fullDependencies(); const request = workflowRequest();
  const paused = await runFullWorkflow(request, store, deps, { humanInput: true });
  await expect(runFullWorkflow(request, store, deps, { resume: { responseId: randomUUID(), answers: [] } })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  expect(deps.ai.generate).toHaveBeenCalledTimes(2);
  expect(() => parseFullSnapshot({ ...paused, human: { ...paused.human, responseId: randomUUID(), responses: [{ question: "Forged question", answer: "yes" }] } })).toThrow("INVALID_CHECKPOINT");
});
it("stops without searching when the pause checkpoint fails to save", async () => {
  const store = new MemoryFullStore(); const deps = fullDependencies(); const save = store.save.bind(store);
  vi.spyOn(store, "save").mockImplementation(async (next, version) => { if (next.state === "ACTION_REQUIRED") throw new Error("ambiguous write"); await save(next, version); });
  await expect(runFullWorkflow(workflowRequest(), store, deps, { humanInput: true })).rejects.toMatchObject({ code: "PERSISTENCE" });
  expect(deps.research.search).not.toHaveBeenCalled(); expect(deps.ai.generate).toHaveBeenCalledTimes(2);
});
