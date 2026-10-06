import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MonitoringConditions } from "@/components/workspace/monitoring-conditions";
import { DemoProvider } from "@/components/demo/demo-provider";

function render(language: string) {
  return renderToStaticMarkup(createElement(DemoProvider, { account: { id: "test", email: "test@example.com", displayName: null, timezone: "Europe/Prague", language } }, createElement(MonitoringConditions, { id: "de305d54-75b4-431b-adb2-eb6b9e546014", conditions: [], enabled: false, problemSolved: true, refresh: () => undefined })));
}

it("shows one clear instruction when monitoring is paused by a solved problem", () => {
  const html = render("en");
  expect(html).toContain("Reopen this problem before resuming or adding monitoring.");
  expect(html).not.toContain("Complete this analysis before adding a monitoring condition.");
  expect(render("cs")).toContain("Před obnovením nebo přidáním sledování zadání znovu otevřete.");
});
