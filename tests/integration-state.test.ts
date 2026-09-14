import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { createGoogleIntegrationState, readGoogleIntegrationState } from "@/lib/integrations/state";

beforeEach(() => {
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "client-id-for-tests.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "test-client-secret-value");
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64url"));
});

it("binds a short-lived signed integration callback to the initiating account", () => {
  const now = 1_800_000_000_000; const state = createGoogleIntegrationState("owner-id", ["calendar", "gmail"], ["calendar"], now);
  expect(readGoogleIntegrationState(state, "owner-id", now + 599_000)).toEqual({ authorized: ["calendar", "gmail"], enabled: ["calendar"] });
  expect(readGoogleIntegrationState(state, "different-id", now)).toBeNull();
  expect(readGoogleIntegrationState(state, "owner-id", now + 601_000)).toBeNull();
});

it("rejects a modified integration state", () => {
  const now = 1_800_000_000_000; const state = createGoogleIntegrationState("owner-id", ["gmail"], ["gmail"], now);
  const parts = state.split("."); parts[1] = `${parts[1][0] === "A" ? "B" : "A"}${parts[1].slice(1)}`;
  expect(readGoogleIntegrationState(parts.join("."), "owner-id", now)).toBeNull();
});
