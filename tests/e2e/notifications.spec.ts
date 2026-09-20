import { test, expect } from "@playwright/test";
import { register } from "./helpers";
test("inbox filtering, read acknowledgement and preference persistence", async ({ page, request }) => {
  await register(page, request);
  let readAt: string | null = null;
  let preferences = { analysis_updates: true, action_required: true, monitoring_updates: true, task_updates: true };
  await page.route("**/api/notifications", async (route) => {
    if (route.request().method() === "PATCH") { readAt = new Date().toISOString(); await route.fulfill({ json: { saved: true } }); return; }
    await route.fulfill({ json: { items: [{ id: "11111111-1111-4111-8111-111111111111", problem_id: "22222222-2222-4222-8222-222222222222", kind: "input_required", created_at: new Date().toISOString(), read_at: readAt }], preferences } });
  });
  await page.route("**/api/notifications/preferences", async (route) => { preferences = route.request().postDataJSON(); await route.fulfill({ json: { saved: true } }); });
  await page.goto("/notifications");
  await expect(page.getByText("Avenli needs your answers", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open problem", exact: true })).toHaveAttribute("href", "/problems/22222222-2222-4222-8222-222222222222");
  await page.getByLabel("Unread only", { exact: true }).check();
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(page.getByText("No unread notifications.", { exact: true })).toBeVisible();
  await page.getByLabel("Analysis completion and failures", { exact: true }).uncheck();
  await expect(page.getByLabel("Task due date reminders", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page.getByText("Preferences saved.", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByLabel("Analysis completion and failures", { exact: true })).not.toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/notifications-mobile.png", fullPage: true });
});
