import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/workspace/http", () => ({ WorkspaceError: class extends Error {} }));
vi.mock("@/lib/orchestration/full", () => ({ runFullWorkflow: vi.fn() }));
vi.mock("@/lib/orchestration/supabase-store", () => ({ createFullWorkflowStore: vi.fn(async () => ({})) }));
vi.mock("@/lib/ai/nebius", () => ({ createNebiusProvider: () => ({ model: "fixture", generate: vi.fn() }) }));
vi.mock("@/lib/ai/research", () => ({ createTavilyProvider: () => ({ search: vi.fn() }) }));
import { execute } from "@/lib/workspace/execution";
import { runFullWorkflow } from "@/lib/orchestration/full";
import { AIError } from "@/lib/ai/errors";

const job = { id: randomUUID(), problemId: randomUUID(), status: "running", error: null, expiresAt: new Date(Date.now() + 1_200_000).toISOString() };
function client(claim: unknown = job) {
  const rpc = vi.fn((name: string) => ({ abortSignal: async () => ({ data: name === "claim_web_run" ? claim : true, error: null }) }));
  return { rpc };
}
beforeEach(() => { vi.clearAllMocks(); });
it("does not run providers when the claim was already consumed", async () => {
  const db = client(null);
  await execute(db as never, job.id, "private-token");
  expect(runFullWorkflow).not.toHaveBeenCalled();
  expect(db.rpc).toHaveBeenCalledTimes(1);
});
it("finishes a successful claimed workflow with the same protected identity", async () => {
  vi.mocked(runFullWorkflow).mockResolvedValue({ state: "COMPLETED", error: null } as never);
  const db = client(); await execute(db as never, job.id, "private-token");
  expect(runFullWorkflow).toHaveBeenCalledTimes(1);
  expect(vi.mocked(runFullWorkflow).mock.calls[0][0]).toEqual({ runId: job.id, problemId: job.problemId });
  expect(db.rpc).toHaveBeenLastCalledWith("finish_web_run", { p_run_id: job.id, p_secret: "private-token", p_status: "completed", p_error: null });
});
it.each([new AIError("TIMEOUT"), new Error("private upstream body")])("sanitizes worker failure", async (error) => {
  vi.mocked(runFullWorkflow).mockRejectedValue(error);
  const db = client(); await execute(db as never, job.id, "private-token");
  expect(db.rpc).toHaveBeenLastCalledWith("finish_web_run", { p_run_id: job.id, p_secret: "private-token", p_status: "failed", p_error: error instanceof AIError ? "TIMEOUT" : "PERSISTENCE" });
});
it("publishes a waiting checkpoint without marking the analysis complete", async () => {
  const checkpoint = { state: "ACTION_REQUIRED", error: null };
  vi.mocked(runFullWorkflow).mockResolvedValue(checkpoint as never);
  const db = client(); await execute(db as never, job.id, "private-token");
  expect(db.rpc).toHaveBeenLastCalledWith("pause_web_run", { p_run_id: job.id, p_secret: "private-token", p_checkpoint: checkpoint });
  expect(db.rpc.mock.calls.some(([name]) => name === "finish_web_run")).toBe(false);
});


afterEach(() => { vi.useRealTimers(); });
it("counts request setup against the Hobby budget and records timeout without starting AI", async () => {
  const db = client();
  await execute(db as never, job.id, "private-token", Date.now() - 241_000);
  expect(runFullWorkflow).not.toHaveBeenCalled();
  expect(db.rpc).toHaveBeenLastCalledWith("finish_web_run", { p_run_id: job.id, p_secret: "private-token", p_status: "failed", p_error: "TIMEOUT" });
});
it("refuses further paid calls when the shared request budget is exhausted", async () => {
  vi.useFakeTimers();
  vi.mocked(runFullWorkflow).mockImplementation(async (_raw, _store, deps) => {
    vi.setSystemTime(Date.now() + 241_000);
    await deps.research!.search("late query", new AbortController().signal);
    throw new Error("must not reach here");
  });
  const db = client();
  await execute(db as never, job.id, "private-token");
  expect(db.rpc).toHaveBeenLastCalledWith("finish_web_run", { p_run_id: job.id, p_secret: "private-token", p_status: "failed", p_error: "TIMEOUT" });
});
