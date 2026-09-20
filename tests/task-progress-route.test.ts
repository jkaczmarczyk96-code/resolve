import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ identity: vi.fn(), body: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/workspace/http", () => ({
  identity: mock.identity,
  body: mock.body,
  json: (value: unknown, status = 200) => Response.json(value, { status }),
  WorkspaceError: class extends Error { constructor(public code: string, public status = 400) { super(code); } },
  failure: (error: { code?: string; status?: number }) => Response.json({ error: error.code ?? "SERVICE_UNAVAILABLE" }, { status: error.status ?? 503 }),
}));
import { PATCH } from "@/app/api/problems/[id]/tasks/route";

const problemId = "de305d54-75b4-431b-adb2-eb6b9e546014";
const taskId = "de305d54-75b4-431b-adb2-eb6b9e546015";

beforeEach(() => { vi.resetAllMocks(); });

it("updates only a generated task inside the requested problem", async () => {
  const query = { update: vi.fn(), eq: vi.fn(), not: vi.fn(), select: vi.fn(), abortSignal: vi.fn(), maybeSingle: vi.fn() };
  query.update.mockReturnValue(query); query.eq.mockReturnValue(query); query.not.mockReturnValue(query); query.select.mockReturnValue(query); query.abortSignal.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: { id: taskId, status: "completed", completed_at: "2026-09-20T12:00:00.000Z", due_at: null }, error: null });
  mock.identity.mockResolvedValue({ client: { from: vi.fn().mockReturnValue(query) }, user: { id: "owner" } });
  mock.body.mockResolvedValue({ taskId, status: "completed" });

  const response = await PATCH(new Request("https://avenli.example/api", { method: "PATCH" }), { params: Promise.resolve({ id: problemId }) });
  expect(response.status).toBe(200);
  expect(query.update).toHaveBeenCalledWith({ status: "completed", completed_at: expect.stringMatching(/^2026-/) });
  expect(query.eq).toHaveBeenNthCalledWith(1, "id", taskId);
  expect(query.eq).toHaveBeenNthCalledWith(2, "problem_id", problemId);
  expect(query.not).toHaveBeenCalledWith("workflow_run_id", "is", null);
});

it("sets and clears a future task due date without changing its status", async () => {
  const query = { update: vi.fn(), eq: vi.fn(), not: vi.fn(), select: vi.fn(), abortSignal: vi.fn(), maybeSingle: vi.fn() };
  query.update.mockReturnValue(query); query.eq.mockReturnValue(query); query.not.mockReturnValue(query); query.select.mockReturnValue(query); query.abortSignal.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: { id: taskId, status: "pending", completed_at: null, due_at: "2099-10-01T09:00:00.000Z" }, error: null });
  mock.identity.mockResolvedValue({ client: { from: vi.fn().mockReturnValue(query) }, user: { id: "owner" } });
  mock.body.mockResolvedValue({ taskId, dueAt: "2099-10-01T09:00:00.000Z" });
  const response = await PATCH(new Request("https://avenli.example/api", { method: "PATCH" }), { params: Promise.resolve({ id: problemId }) });
  expect(response.status).toBe(200);
  expect(query.update).toHaveBeenCalledWith({ due_at: "2099-10-01T09:00:00.000Z" });
});

it("rejects past due dates", async () => {
  const from = vi.fn(); mock.identity.mockResolvedValue({ client: { from }, user: { id: "owner" } });
  mock.body.mockResolvedValue({ taskId, dueAt: "2020-01-01T00:00:00.000Z" });
  const response = await PATCH(new Request("https://avenli.example/api", { method: "PATCH" }), { params: Promise.resolve({ id: problemId }) });
  expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: "INVALID_TASK_DUE_DATE" }); expect(from).not.toHaveBeenCalled();
});

it("rejects an invalid task status before querying the database", async () => {
  const from = vi.fn();
  mock.identity.mockResolvedValue({ client: { from }, user: { id: "owner" } });
  mock.body.mockResolvedValue({ taskId, status: "executed" });
  const response = await PATCH(new Request("https://avenli.example/api", { method: "PATCH" }), { params: Promise.resolve({ id: problemId }) });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "INVALID_TASK" });
  expect(from).not.toHaveBeenCalled();
});
