import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { GoogleIntegrationSettings } from "@/components/workspace/google-integration-settings";
import { DemoProvider } from "@/components/demo/demo-provider";

function render(language: string) {
  return renderToStaticMarkup(createElement(DemoProvider, { account: { id: "test", email: "test@example.com", displayName: null, timezone: "Europe/Prague", language } }, createElement(GoogleIntegrationSettings, { enabled: true, connection: null })));
}

it("offers Calendar and Gmail as separate optional connections", () => {
  const html = render("en");
  expect(html).toContain("Google Calendar");
  expect(html).toContain("Gmail");
  expect(html).toContain('href="/auth/integrations/google?service=calendar"');
  expect(html).toContain('href="/auth/integrations/google?service=gmail"');
  expect(html).toContain("Every service is optional");
  expect(render("cs")).toContain("Každá je volitelná");
});
