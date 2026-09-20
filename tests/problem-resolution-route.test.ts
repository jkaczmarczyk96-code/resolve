import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ identity: vi.fn(), body: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/workspace/http", () => ({
  identity: mock.identity, body: mock.body, json: (value: unknown, status = 200) => Response.json(value, { status }),
  WorkspaceError: class extends Error { constructor(public code: string, public status = 400) { super(code); } },
  failure: (error: { code?: string; status?: number }) => Response.json({ error: error.code ?? "SERVICE_UNAVAILABLE" }, { status: error.status ?? 503 }),
}));
import { PATCH } from "@/app/api/problems/[id]/resolution/route";

const problem = "de305d54-75b4-431b-adb2-eb6b9e546014";
beforeEach(() => { vi.resetAllMocks(); mock.identity.mockResolvedValue({ client: { rpc: mock.rpc }, user: { id: "owner" } }); });

it("calls the owner-scoped resolution function with a validated state", async () => {
  mock.body.mockResolvedValue({ solved: true });
  mock.rpc.mockReturnValue({ abortSignal: vi.fn().mockResolvedValue({ data: { status: "solved", solvedAt: "2026-09-20T12:00:00.000Z" }, error: null }) });
  const response = await PATCH(new Request("https://avenli.example/api", { method: "PATCH" }), { params: Promise.resolve({ id: problem }) });
  expect(response.status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith("set_problem_resolution", { p_problem_id: problem, p_solved: true });
});

it("rejects malformed state before calling the database", async () => {
  mock.body.mockResolvedValue({ solved: "yes" });
  const response = await PATCH(new Request("https://avenli.example/api", { method: "PATCH" }), { params: Promise.resolve({ id: problem }) });
  expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: "INVALID_RESOLUTION" }); expect(mock.rpc).not.toHaveBeenCalled();
});

