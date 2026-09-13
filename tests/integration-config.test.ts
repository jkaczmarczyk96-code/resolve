import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { googleIntegrationEnabledFor } from "@/lib/integrations/config";

beforeEach(() => { vi.stubEnv("GOOGLE_INTEGRATIONS_ENABLED", "true"); vi.stubEnv("GOOGLE_INTEGRATION_TEST_USERS", " Owner@Example.com, second@example.com "); });

it("limits the pre-verification Google data integration to explicit tester emails", () => {
  expect(googleIntegrationEnabledFor("owner@example.com")).toBe(true);
  expect(googleIntegrationEnabledFor("SECOND@example.com")).toBe(true);
  expect(googleIntegrationEnabledFor("public@example.com")).toBe(false);
  vi.stubEnv("GOOGLE_INTEGRATIONS_ENABLED", "false");
  expect(googleIntegrationEnabledFor("owner@example.com")).toBe(false);
});
