import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { createGoogleIntegrationState, validGoogleIntegrationState } from "@/lib/integrations/state";

beforeEach(() => {
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "client-id-for-tests.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "test-client-secret-value");
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64url"));
});

it("binds a short-lived signed integration callback to the initiating account", () => {
  const now = 1_800_000_000_000; const state = createGoogleIntegrationState("owner-id", now);
  expect(validGoogleIntegrationState(state, "owner-id", now + 599_000)).toBe(true);
  expect(validGoogleIntegrationState(state, "different-id", now)).toBe(false);
  expect(validGoogleIntegrationState(state, "owner-id", now + 601_000)).toBe(false);
});

it("rejects a modified integration state", () => {
  const now = 1_800_000_000_000; const state = createGoogleIntegrationState("owner-id", now);
  const parts = state.split("."); parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
  expect(validGoogleIntegrationState(parts.join("."), "owner-id", now)).toBe(false);
});
