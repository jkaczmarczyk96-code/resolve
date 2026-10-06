import { expect, test } from "@playwright/test";
import { register } from "./helpers";
import { randomUUID } from "node:crypto";
import { outputs, sources } from "../fixtures/ai";
import { parseFullSnapshot } from "@/lib/orchestration/full-state";

test("workspace pages stay compact and fit desktop and mobile widths", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Give it a problem/ })).toBeVisible();
  await page.screenshot({ path: "test-results/ui-home-desktop.png", fullPage: true, animations: "disabled" });
  await page.goto("/register");
  await page.screenshot({ path: "test-results/ui-register-desktop.png", fullPage: true, animations: "disabled" });
  await page.goto("/login");
  await page.screenshot({ path: "test-results/ui-login-desktop.png", fullPage: true, animations: "disabled" });
  await page.goto("/demo");
  await page.screenshot({ path: "test-results/ui-demo-desktop.png", fullPage: true, animations: "disabled" });
  await page.goto("/demo/problems");
  await page.screenshot({ path: "test-results/ui-demo-list-desktop.png", fullPage: true, animations: "disabled" });
  await page.goto("/demo/problems/new");
  await page.screenshot({ path: "test-results/ui-demo-new-desktop.png", fullPage: true, animations: "disabled" });
  await page.goto("/demo/problems/demo-launch");
  await expect(page.getByRole("heading", { name: "A direction worth exploring" })).toBeVisible();
  await expect(page.locator("summary").filter({ hasText: "Your goal and priority" })).toBeVisible();
  await page.screenshot({ path: "test-results/ui-demo-problem-desktop.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, file] of [["/", "home"], ["/login", "login"], ["/register", "register"], ["/demo/problems/new", "demo-new"], ["/demo/problems/demo-launch", "demo-problem"]]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/ui-${file}-mobile.png`, fullPage: true, animations: "disabled" });
  }
  await page.getByRole("navigation", { name: "Problem sections" }).getByRole("combobox", { name: "More sections" }).selectOption("options");
  await expect(page.getByRole("heading", { name: "Side-by-side comparison" })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await register(page, request);
  await page.route("**/api/problems", async (route) => route.request().method() === "GET" ? route.fulfill({ json: [] }) : route.fallback());
  await page.route("**/api/notifications", async (route) => route.fulfill({ json: { items: [{ id: "11111111-1111-4111-8111-111111111111", problem_id: "22222222-2222-4222-8222-222222222222", kind: "analysis_completed", created_at: new Date().toISOString(), read_at: null }], preferences: { analysis_updates: true, action_required: true, monitoring_updates: true, task_updates: true } } }));
  for (const [path, heading, file] of [
    ["/dashboard", "Welcome, Resolve Tester", "dashboard"],
    ["/problems", "Your problems", "problems"],
    ["/problems/new", "What do you need to solve?", "new-problem"],
    ["/notifications", "Notifications", "notifications"],
    ["/settings", "Account settings", "settings"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    if (path === "/dashboard" || path === "/problems") await expect(page.getByRole("status", { name: "Loading your problems" })).toHaveCount(0);
    if (path === "/notifications") await expect(page.getByRole("heading", { name: "Your updates" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/ui-${file}-desktop.png`, fullPage: true, animations: "disabled" });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, heading, file] of [["/dashboard", "Welcome, Resolve Tester", "dashboard"], ["/problems", "Your problems", "problems"], ["/problems/new", "What do you need to solve?", "new-problem"], ["/notifications", "Notifications", "notifications"], ["/settings", "Account settings", "settings"]]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    if (path === "/dashboard" || path === "/problems") await expect(page.getByRole("status", { name: "Loading your problems" })).toHaveCount(0);
    if (path === "/notifications") await expect(page.getByRole("heading", { name: "Your updates" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/ui-${file}-mobile.png`, fullPage: true, animations: "disabled" });
  }
  const now = new Date().toISOString();
  const items = [
    { problem: { id: randomUUID(), title: "Find a route to Tokyo", original_input: "Compare routes and prices before my meeting in Tokyo.", status: "solved", created_at: now, solved_at: now }, job: null, dueTaskCount: 0 },
    { problem: { id: randomUUID(), title: "Plan a move abroad", original_input: "Prepare the move and identify decisions still needed.", status: "action_required", created_at: now, solved_at: null }, job: { id: randomUUID(), problemId: null, status: "action_required", error: null, expiresAt: new Date(Date.now() + 60_000).toISOString() }, dueTaskCount: 2 },
  ];
  await page.unroute("**/api/problems");
  await page.route("**/api/problems", async (route) => route.request().method() === "GET" ? route.fulfill({ json: items }) : route.fallback());
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ["/dashboard", "/problems"]) {
    await page.goto(path);
    await expect(page.getByText("Plan a move abroad")).toBeVisible();
    await page.screenshot({ path: `test-results/ui-${path.slice(1)}-filled-desktop.png`, fullPage: true, animations: "disabled" });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/problems");
  await expect(page.getByText("Plan a move abroad")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/ui-problems-filled-mobile.png", fullPage: true, animations: "disabled" });
});

test("completed problem shows the decision first and keeps deep analysis available", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await register(page, request);
  const problemId = randomUUID();
  const runId = randomUUID();
  const now = new Date().toISOString();
  const states = ["PENDING", "INTAKE", "PLAN", "RESEARCH", "VERIFY", "OPTIONS", "CRITIQUE", "DECIDE", "TASKS", "COMPLETED"] as const;
  const snapshot = parseFullSnapshot({
    version: 2, id: runId, problemId, model: "fixture", description: "Help me plan a community event for 20 people with a budget of EUR 500.",
    state: "COMPLETED", revision: 9, events: states.map((state) => ({ state, at: now })),
    intake: outputs.intake, plan: outputs.planner,
    research: { question: "What is the venue capacity?", output: outputs.researcher, sources },
    verification: outputs.verifier, options: outputs.options, critique: outputs.critic, decision: outputs.decision, tasks: outputs.tasks, error: null,
  });
  await page.route(`**/api/problems/${problemId}`, async (route) => route.fulfill({ json: {
    problem: { id: problemId, title: "Plan a community event", original_input: snapshot.description, status: "planning", created_at: now, solved_at: null },
    job: { id: runId, problemId, status: "completed", error: null, expiresAt: new Date(Date.now() + 60_000).toISOString() },
    snapshot, humanRequest: null, conditions: [], tasks: [], lifecycle: [], actions: [],
    actionAccess: { calendarEnabled: false, calendarWriteAuthorized: false },
  } }));
  await page.goto(`/problems/${problemId}`);
  await expect(page.getByRole("heading", { name: "Result", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Analysis progress" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Problem sections" }).getByRole("combobox", { name: "More sections" })).toBeVisible();
  await page.screenshot({ path: "test-results/ui-problem-result-desktop.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/ui-problem-result-mobile.png", fullPage: true, animations: "disabled" });
  await page.getByRole("navigation", { name: "Problem sections" }).getByRole("combobox", { name: "More sections" }).selectOption("options");
  await expect(page.getByRole("heading", { name: "Options to consider" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/ui-problem-options-mobile.png", fullPage: true, animations: "disabled" });
});
