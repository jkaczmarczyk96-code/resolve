import { test, expect } from "@playwright/test";
import { register } from "./helpers";

test("production surface exposes health and defensive browser headers", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", service: "avenli" });
  const home = await request.get("/");
  expect(home.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(home.headers()["permissions-policy"]).toContain("camera=()");
  expect(home.headers()["x-content-type-options"]).toBe("nosniff");
});

test("public demo is fully explorable without an account", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Explore the demo" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText("Interactive public demo", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome, Demo visitor" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Demo workspace", exact: true }).getByRole("link", { name: "Problems", exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/problems$/);
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Find a way to Tokyo" }) }).click();
  await expect(page).toHaveURL(/\/demo\/problems\/demo-flight$/);
  await expect(page.getByRole("heading", { name: "The outcome" })).toBeVisible();
  await page.getByRole("navigation", { name: "Problem sections" }).getByRole("link", { name: "Options", exact: true }).click();
  await expect(page).toHaveURL(/view=options$/);
  await expect(page.getByRole("table", { name: "Illustrative option comparison" })).toBeVisible();
});

test("new accounts get a short, controllable onboarding", async ({ page, request }) => {
  await register(page, request, false);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Tell Avenli what you need to achieve." })).toBeVisible();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("heading", { name: "Avenli researches, plans, and evaluates." })).toBeVisible();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("heading", { name: "You stay in control." })).toBeVisible();
  await dialog.getByRole("button", { name: "Create your first problem" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("filter scenarios, inspect evidence and compare options", async ({ page, request }) => {
  await register(page, request);
  await page.goto("/dashboard?demo=1");
  await expect(page.getByText("Interactive demo", { exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Workspace", exact: true }).getByRole("link", { name: "Problems", exact: true }).click();
  await page.getByLabel("Search problems").fill("Tokyo");
  await expect(page.getByRole("heading", { name: "Find a way to Tokyo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Make a plan for moving abroad" })).toHaveCount(0);
  await page.getByLabel("Status", { exact: true }).selectOption("Waiting");
  await expect(page.getByRole("heading", { name: "No matching problems" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Find a way to Tokyo" }) }).click();
  await expect(page.getByRole("heading", { name: "The outcome" })).toBeVisible();
  await page.screenshot({ path: "test-results/workspace-desktop.png", fullPage: true });
  const sections = page.getByRole("navigation", { name: "Problem sections" });
  await sections.getByRole("link", { name: "Research", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Evidence register" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Unverified sample", exact: true })).toHaveCount(3);
  await sections.getByRole("link", { name: "Options", exact: true }).click();
  await page.getByLabel("Compare Connect via Frankfurt", { exact: true }).uncheck();
  await expect(page.getByRole("table", { name: "Illustrative option comparison" }).getByRole("columnheader", { name: "Connect via Frankfurt" })).toHaveCount(0);
  await sections.getByRole("link", { name: "Decisions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Decision trail" })).toBeVisible();
  await page.getByRole("link", { name: "Connection via Vienna", exact: true }).click();
  await expect(page).toHaveURL(/view=research$/);
  await sections.getByRole("link", { name: "Risks", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A missed connection" })).toBeVisible();
});

test("demo task changes survive navigation but reset on reload", async ({ page, request }) => {
  await register(page, request);
  await page.goto("/dashboard?demo=1");
  await page.getByRole("link", { name: "Review problem", exact: true }).click();
  const sections = page.getByRole("navigation", { name: "Problem sections" });
  await sections.getByRole("link", { name: "Tasks", exact: true }).click();
  await page.getByLabel("Confirm baggage needs", { exact: true }).check();
  await sections.getByRole("link", { name: "Overview", exact: true }).click();
  await sections.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(page.getByLabel("Confirm baggage needs", { exact: true })).toBeChecked();
  await page.reload();
  await expect(page.getByLabel("Confirm baggage needs", { exact: true })).not.toBeChecked();
});

test("new draft is temporary and has no fabricated results", async ({ page, request }) => {
  await register(page, request);
  await page.goto("/dashboard?demo=1");
  await page.getByRole("link", { name: "New problem", exact: true }).first().click();
  await page.getByLabel("Your problem", { exact: true }).fill("Too short");
  await page.getByRole("button", { name: "Create demo draft" }).click();
  await expect(page.getByText("Add a little more detail (at least 20 characters).", { exact: true })).toBeVisible();
  await page.getByLabel("Your problem", { exact: true }).fill("I need to plan a small community event with a €500 budget.");
  await page.getByRole("button", { name: "Create demo draft" }).click();
  await expect(page).toHaveURL(/\/problems\/draft-/);
  const draftURL = page.url();
  await expect(page.getByRole("heading", { name: "No recommendation yet" })).toBeVisible();
  await page.getByRole("link", { name: "All problems", exact: true }).click();
  await expect(page.getByRole("heading", { name: "I need to plan a small community event with a €500 budget." })).toBeVisible();
  await page.goto(draftURL);
  await expect(page.getByRole("heading", { name: "This demo draft is no longer here" })).toBeVisible();
});

test("settings preview and small-screen workspace remain usable", async ({ page, request }) => {
  await register(page, request);
  await page.goto("/dashboard?demo=1");
  const nav = page.getByRole("navigation", { name: "Workspace", exact: true });
  await nav.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Timezone", { exact: true }).selectOption("Asia/Tokyo");
  await page.getByRole("button", { name: "Save preview preferences" }).click();
  await expect(page.getByRole("status")).toContainText("Saved for this demo only");
  await nav.getByRole("link", { name: "Home" }).click();
  await nav.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByLabel("Timezone", { exact: true })).toHaveValue("Asia/Tokyo");
  await page.setViewportSize({ width: 390, height: 844 });
  await nav.getByRole("link", { name: "Home" }).click();
  await page.getByRole("link", { name: "Review problem", exact: true }).click();
  await page.getByRole("navigation", { name: "Problem sections" }).getByRole("link", { name: "Options", exact: true }).click();
  await expect(page).toHaveURL(/view=options$/);
  await expect(page.getByRole("table", { name: "Illustrative option comparison" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/workspace-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?demo=1$/);
  await nav.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByLabel("Timezone", { exact: true })).toHaveValue("UTC");
});
