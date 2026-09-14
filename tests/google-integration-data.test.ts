import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/public-env", () => ({ getPublicEnvironment: () => ({ url: "https://test.supabase.co" }) }));
vi.mock("@/lib/integrations/crypto", () => ({ decryptCredential: () => "provider-access-token", encryptCredential: (value: string) => `encrypted:${value}` }));

import { completeGoogleIntegration, readGmail } from "@/lib/integrations/google";

const credential = {
  integrationId: "de305d54-75b4-431b-adb2-eb6b9e546014",
  accessTokenCiphertext: "a".repeat(32), refreshTokenCiphertext: "r".repeat(32),
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  enabledServices: ["gmail"],
};

beforeEach(() => { vi.restoreAllMocks(); vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test-only"); });

it("reads Gmail metadata and snippets without requesting message bodies or auditing the search text", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url.endsWith("/rpc/get_google_integration_credential")) return Response.json(credential);
    if (url.includes("/messages?") && !url.includes("/messages/message-1")) return Response.json({ messages: [{ id: "message-1" }] });
    if (url.includes("/messages/message-1")) return Response.json({ id: "message-1", snippet: "A short preview", payload: { headers: [
      { name: "Subject", value: "Flight update" }, { name: "From", value: "airline@example.com" }, { name: "Date", value: "Sat, 13 Sep 2026 10:00:00 +0200" },
    ] } });
    if (url.endsWith("/rpc/record_google_integration_event")) return Response.json(true);
    return new Response(null, { status: 404 });
  }));

  await expect(readGmail("owner-id", "flight cancellation")).resolves.toEqual([{ id: "message-1", subject: "Flight update", from: "airline@example.com", date: "Sat, 13 Sep 2026 10:00:00 +0200", snippet: "A short preview" }]);
  const messageCall = calls.find((call) => call.url.includes("/messages/message-1"));
  expect(messageCall?.url).toContain("format=metadata");
  const auditCall = calls.find((call) => call.url.endsWith("/rpc/record_google_integration_event"));
  expect(auditCall?.init?.body).toContain('"resultCount":1');
  expect(auditCall?.init?.body).not.toContain("flight cancellation");
});

it("authorizes and verifies only the selected Calendar service", async () => {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("openidconnect.googleapis.com")) return Response.json({ email: "owner@example.com", email_verified: true });
    if (url.includes("calendarList")) return Response.json({ items: [] });
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  const rpc = vi.fn().mockResolvedValue({ data: "de305d54-75b4-431b-adb2-eb6b9e546014", error: null });
  await completeGoogleIntegration({ rpc } as never, { id: "owner-id", email: "owner@example.com" } as never, { provider_token: "provider-access", provider_refresh_token: "provider-refresh" } as never, ["calendar"], ["calendar"]);
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes("gmail.googleapis.com"))).toBe(false);
  expect(rpc).toHaveBeenCalledWith("save_google_integration", expect.objectContaining({
    p_email: "owner@example.com",
    p_scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    p_enabled_services: ["calendar"],
  }));
});

it("refuses to read a service that the user switched off", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => String(input).endsWith("/rpc/get_google_integration_credential") ? Response.json({ ...credential, enabledServices: ["calendar"] }) : new Response(null, { status: 404 })));
  await expect(readGmail("owner-id", "flight cancellation")).rejects.toMatchObject({ message: "INTEGRATION_SERVICE_DISABLED", status: 409 });
});
