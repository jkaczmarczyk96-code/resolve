import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { GoogleIntegrationSettings } from "@/components/workspace/google-integration-settings";

it("offers Calendar and Gmail as separate optional connections", () => {
  const html = renderToStaticMarkup(createElement(GoogleIntegrationSettings, { enabled: true, connection: null }));
  expect(html).toContain("Google Calendar");
  expect(html).toContain("Gmail");
  expect(html).toContain('href="/auth/integrations/google?service=calendar"');
  expect(html).toContain('href="/auth/integrations/google?service=gmail"');
  expect(html).toContain("Every service is optional");
});
