import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CalendarActions } from "@/components/workspace/calendar-actions";
import type { ExternalAction } from "@/lib/actions/contracts";

const action: ExternalAction = {
  id: "de305d54-75b4-431b-adb2-eb6b9e546015",
  problemId: "de305d54-75b4-431b-adb2-eb6b9e546014",
  actionType: "calendar_create_event",
  status: "proposed",
  payload: {
    summary: "Review Avenli plan",
    description: "Review the saved recommendation.",
    location: "Prague",
    start: "2026-09-15T10:00:00.000Z",
    end: "2026-09-15T11:00:00.000Z",
  },
  result: null,
  error: null,
  attemptCount: 0,
  requestedAt: "2026-09-14T10:00:00.000Z",
  approvedAt: null,
  executedAt: null,
};

function render(actions: ExternalAction[], calendarWriteAuthorized: boolean) {
  return renderToStaticMarkup(createElement(CalendarActions, {
    id: action.problemId,
    title: "Avenli plan",
    actions,
    access: { calendarEnabled: true, calendarWriteAuthorized },
    analysisComplete: true,
    refresh: () => undefined,
  }));
}

it("separates preparing a proposal from approving an external write", () => {
  const html = render([], false);
  expect(html).toContain("Prepare calendar event");
  expect(html).toContain("saves a proposal and audit entry only");
  expect(html).not.toContain("Create event now");
});

it("requests the narrow Calendar write grant from the exact problem context", () => {
  const html = render([action], false);
  expect(html).toContain("Authorize event creation");
  expect(html).toContain(`/auth/integrations/google?service=calendar&amp;access=write&amp;next=%2Fproblems%2F${action.problemId}%3Fview%3Dtasks`);
  expect(html).toContain("Cancel proposal");
});

it("shows a review step after event creation has been authorized", () => {
  const html = render([action], true);
  expect(html).toContain("Review approval");
  expect(html).not.toContain("Create event now");
});
