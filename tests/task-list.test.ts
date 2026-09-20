import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TaskList } from "@/components/workspace/task-list";

it("renders saved task progress without implying automatic execution", () => {
  const html = renderToStaticMarkup(createElement(TaskList, {
    problemId: "de305d54-75b4-431b-adb2-eb6b9e546014",
    generated: [{ id: "review", title: "Review the plan", description: "Check the recommendation before acting.", priority: "high" as const, dependencies: [], planStepId: null, optionId: null, status: "proposed" as const }],
    saved: [{ id: "de305d54-75b4-431b-adb2-eb6b9e546015", sourceId: "review", status: "completed" as const, completedAt: "2026-09-20T12:00:00.000Z" }],
    refresh: () => undefined,
  }));
  expect(html).toContain('aria-label="Status for Review the plan"');
  expect(html).toContain('<option value="completed" selected="">Completed</option>');
  expect(html).toContain("Check the recommendation before acting.");
});
