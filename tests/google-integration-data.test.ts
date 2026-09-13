import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/public-env", () => ({ getPublicEnvironment: () => ({ url: "https://test.supabase.co" }) }));
vi.mock("@/lib/integrations/crypto", () => ({ decryptCredential: () => "provider-access-token", encryptCredential: (value: string) => `encrypted:${value}` }));

import { readGmail } from "@/lib/integrations/google";

const credential = {
  integrationId: "de305d54-75b4-431b-adb2-eb6b9e546014",
  accessTokenCiphertext: "a".repeat(32), refreshTokenCiphertext: "r".repeat(32),
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
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
