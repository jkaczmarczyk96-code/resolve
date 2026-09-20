import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MonitoringConditions } from "@/components/workspace/monitoring-conditions";

it("shows one clear instruction when monitoring is paused by a solved problem", () => {
  const html = renderToStaticMarkup(createElement(MonitoringConditions, { id: "de305d54-75b4-431b-adb2-eb6b9e546014", conditions: [], enabled: false, problemSolved: true, refresh: () => undefined }));
  expect(html).toContain("Reopen this problem before resuming or adding monitoring.");
  expect(html).not.toContain("Complete this analysis before adding a monitoring condition.");
});
