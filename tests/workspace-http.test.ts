import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/config/server-env", () => ({ getSiteOrigin: () => "http://127.0.0.1:3000" }));
import { body, failure, WorkspaceError } from "@/lib/workspace/http";
const request = (text: string, origin = "http://127.0.0.1:3000", type = "application/json") => new Request("http://127.0.0.1:3000/api/problems", { method: "POST", headers: { origin, "content-type": type }, body: text });
it("validates origin, content type, JSON and streamed byte limits", async () => {
  await expect(body(request('{"description":"safe"}'))).resolves.toEqual({ description: "safe" });
  await expect(body(request("{}", "https://foreign.example"))).rejects.toMatchObject({ code: "INVALID_ORIGIN", status: 403 });
  await expect(body(request("{}", undefined, "text/plain"))).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  await expect(body(request("broken"))).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  await expect(body(request(JSON.stringify("界".repeat(20_001))))).rejects.toMatchObject({ code: "INPUT_TOO_LARGE", status: 413 });
});
it("returns uncached sanitized failures", async () => {
  const response = failure(new Error("private upstream details"));
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "SERVICE_UNAVAILABLE" });
  expect(failure(new WorkspaceError("SIGN_IN_REQUIRED", 401)).status).toBe(401);
});
