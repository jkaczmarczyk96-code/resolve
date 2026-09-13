import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ deleteUser: vi.fn(), verifyPassword: vi.fn(), signOut: vi.fn(), getClaims: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { admin: { deleteUser: mock.deleteUser } } }) }));
vi.mock("@/lib/config/public-env", () => ({ getPublicEnvironment: () => ({ url: "https://test.supabase.co" }) }));
vi.mock("@/lib/account/security", () => ({ verifyPassword: mock.verifyPassword, recentOAuth: () => false }));
vi.mock("@/lib/workspace/http", () => ({
  identity: async () => ({ user: { id: "verified-owner", email: "owner@example.com" }, client: { auth: { getClaims: mock.getClaims, signOut: mock.signOut } } }),
  body: async (request: Request) => request.json(), json: (value: unknown) => Response.json(value),
  WorkspaceError: class extends Error { constructor(message: string, public status = 400) { super(message); } },
  failure: (error: { message: string; status?: number }) => Response.json({ error: error.message }, { status: error.status ?? 503 }),
}));
import { POST } from "@/app/api/account/delete/route";
function request(value: object) { return new Request("https://avenli.example/api/account/delete", { method: "POST", body: JSON.stringify(value) }); }
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test-only"); mock.getClaims.mockResolvedValue({ data: { claims: {} } }); });
it("rejects deletion without fresh authentication or exact confirmation", async () => {
  expect((await POST(request({ confirmation: "DELETE", currentPassword: "" }))).status).toBe(403);
  expect((await POST(request({ confirmation: "yes", currentPassword: "password" }))).status).toBe(400);
  expect(mock.deleteUser).not.toHaveBeenCalled();
});
it("deletes only the verified identity after a valid password proof", async () => {
  mock.verifyPassword.mockResolvedValue({ auth: { signOut: mock.signOut } }); mock.deleteUser.mockResolvedValue({ error: null });
  expect((await POST(request({ confirmation: "DELETE", currentPassword: "password" }))).status).toBe(200);
  expect(mock.deleteUser).toHaveBeenCalledWith("verified-owner");
});
it("does not accept a caller-supplied deletion identity", async () => {
  expect((await POST(request({ confirmation: "DELETE", currentPassword: "password", userId: "victim" }))).status).toBe(400);
  expect(mock.deleteUser).not.toHaveBeenCalled();
});
