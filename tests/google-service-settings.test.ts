import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ setEnabled: vi.fn(), enabledFor: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/integrations/config", () => ({ googleIntegrationEnabledFor: mock.enabledFor }));
vi.mock("@/lib/integrations/google", () => ({ setGoogleServiceEnabled: mock.setEnabled }));
vi.mock("@/lib/workspace/http", () => ({
  identity: async () => ({ user: { id: "owner-id", email: "owner@example.com" }, client: { rpc: vi.fn() } }),
  body: async (request: Request) => request.json(),
  json: (value: unknown) => Response.json(value),
  WorkspaceError: class extends Error { constructor(message: string, public status = 400) { super(message); } },
  failure: (error: { message: string; status?: number }) => Response.json({ error: error.message }, { status: error.status ?? 503 }),
}));

import { POST } from "@/app/api/integrations/google/services/route";

function request(value: object) { return new Request("https://avenli.example/api/integrations/google/services", { method: "POST", body: JSON.stringify(value) }); }
beforeEach(() => { vi.resetAllMocks(); mock.enabledFor.mockReturnValue(true); mock.setEnabled.mockResolvedValue(undefined); });

it("updates one explicitly selected Google service", async () => {
  const response = await POST(request({ service: "calendar", enabled: false }));
  expect(response.status).toBe(200);
  expect(mock.setEnabled).toHaveBeenCalledWith(expect.anything(), "calendar", false);
  await expect(response.json()).resolves.toEqual({ service: "calendar", enabled: false });
});

it("rejects unknown services and unavailable accounts", async () => {
  expect((await POST(request({ service: "drive", enabled: true }))).status).toBe(400);
  mock.enabledFor.mockReturnValue(false);
  expect((await POST(request({ service: "gmail", enabled: true }))).status).toBe(503);
  expect(mock.setEnabled).not.toHaveBeenCalled();
});
