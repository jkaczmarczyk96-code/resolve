import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { register } from "./helpers";

test("submission shows saved progress and routes to requested clarification", async ({ page, request }) => {
  await register(page, request);
  const problemId = randomUUID(); const runId = randomUUID();
  let state: "queued" | "action_required" = "queued";
  const job = () => ({ id: runId, problemId, status: state, error: null, expiresAt: new Date(Date.now() + 60_000).toISOString() });
  await page.route("**/api/problems", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify(job()) });
  });
  await page.route(`**/api/problems/${problemId}`, async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      problem: { id: problemId, title: "Workshop plan", original_input: "Plan a workshop for our volunteers this month.", status: state === "queued" ? "analyzing" : "action_required", created_at: new Date().toISOString(), solved_at: null },
      job: job(), snapshot: null,
      humanRequest: state === "action_required" ? { runId, questions: ["How many people will attend?"], answers: null, answeredAt: null } : null,
      conditions: [], tasks: [], lifecycle: [], actions: [], actionAccess: { calendarEnabled: false, calendarWriteAuthorized: false },
    }) });
  });
  await page.goto("/problems/new");
  await page.getByLabel("Your problem", { exact: true }).fill("Plan a workshop for our volunteers this month.");
  await page.getByRole("button", { name: "Solve this" }).click();
  await expect(page).toHaveURL(new RegExp(`/problems/${problemId}$`));
  await expect(page.getByRole("dialog", { name: "Working on your problem" })).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("0 of 8 stages saved");
  await page.screenshot({ path: "test-results/analysis-progress-modal.png", fullPage: true });
  state = "action_required";
  await expect(page).toHaveURL(/view=questions/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Avenli needs your input" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: "test-results/analysis-questions.png", fullPage: true });
});

test("Czech profile preference localizes the main problem-solving flow", async ({ page, request }) => {
  await register(page, request);
  await page.goto("/settings");
  await page.getByLabel("Preferred language").selectOption("cs");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("link", { name: "Nové zadání", exact: true }).first()).toBeVisible();
  await page.goto("/problems/new");
  await expect(page.getByRole("heading", { name: "Co potřebujete vyřešit?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Vyřešit zadání" })).toBeVisible();
  await page.screenshot({ path: "test-results/czech-new-problem.png", fullPage: true });
});

test("problem list shows animated card placeholders while its data loads", async ({ page, request }) => {
  await register(page, request);
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/problems", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await pending;
    await route.fulfill({ contentType: "application/json", body: "[]" });
  });
  try {
    await page.goto("/problems");
    const placeholder = page.getByRole("status", { name: "Loading your problems" });
    await expect(placeholder).toBeVisible();
    await expect(placeholder.locator(".avenli-skeleton")).toHaveCount(15);
    await expect(page.getByText("Loading your problems", { exact: true })).toBeHidden();
    await page.screenshot({ path: "test-results/problem-list-loading.png", fullPage: true });
  } finally {
    release?.();
  }
  await expect(page.getByRole("status", { name: "Loading your problems" })).toHaveCount(0);
});
