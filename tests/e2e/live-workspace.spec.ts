import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { register, live, password, baseURL } from "./helpers";

test.skip(!live, "Requires local Supabase and configured Nebius/Tavily keys.");
test("saved live analysis, idempotent submission, account isolation and explicit retry", async ({ page, request, browser }) => {
  test.setTimeout(600_000);
  const account = await register(page, request);
  await expect(page.getByText("Interactive demo", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "New problem", exact: true }).first().click();
  const description = "Create a small developer checklist comparing JSON object output and JSON schema output in Nebius Token Factory. Research official public Nebius documentation. The result is a draft for one developer; no deployment or external actions are needed.";
  await page.getByLabel("Your problem", { exact: true }).fill(description);
  const outgoing = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/problems"));
  await page.getByRole("button", { name: "Analyze problem", exact: true }).click();
  const submission = (await outgoing).postDataJSON();
  await expect(page).toHaveURL(/\/problems\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  const duplicate = await page.request.post("/api/problems", { data: submission, headers: { Origin: baseURL } });
  expect(duplicate.status()).toBe(202);
  expect((await duplicate.json()).problemId).toBe(id);
  expect(duplicate.headers()["cache-control"]).toContain("no-store");
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Analysis progress" })).toBeVisible();
  await expect.poll(async () => {
    const detail = await (await page.request.get(`/api/problems/${id}`)).json();
    return { status: detail.job?.status, error: detail.job?.error };
  }, { timeout: 270_000, intervals: [2000, 5000] }).toEqual({ status: "completed", error: null });
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  const result = await (await page.request.get(`/api/problems/${id}`)).json();
  expect(result.snapshot.events).toHaveLength(10);
  expect(result.snapshot.qualityPolicy).toBe(1);
  await expect(page.getByRole("heading", { name: "Evidence quality", exact: true })).toBeVisible();
  expect(result.snapshot.research.sources.length).toBeGreaterThan(0);
  const sections = page.getByRole("navigation", { name: "Problem sections" });
  for (const [tab, heading] of [["Research", "Retrieved sources"], ["Options", "Options to consider"], ["Risks", "Critic review"], ["Tasks", "Action plan"], ["Decisions", "Decision trail"]]) {
    await sections.getByRole("link", { name: tab, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await sections.getByRole("link", { name: "Tasks", exact: true }).click();
  const firstTaskStatus = page.locator('select[aria-label^="Status for"]').first();
  await expect(firstTaskStatus).toBeEnabled();
  await firstTaskStatus.selectOption("completed");
  await expect(firstTaskStatus).toHaveValue("completed");
  await page.reload();
  await expect(page.locator('select[aria-label^="Status for"]').first()).toHaveValue("completed");
  await page.screenshot({ path: "test-results/live-workspace-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await sections.getByRole("link", { name: "Research", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Retrieved sources" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/live-workspace-mobile.png", fullPage: true });

  const other = await browser.newContext({ baseURL });
  try {
    expect((await other.request.get(`/api/problems/${id}`)).status()).toBe(401);
    await register(await other.newPage(), other.request);
    expect((await other.request.get(`/api/problems/${id}`)).status()).toBe(404);
    expect((await other.request.post(`/api/problems/${id}/retry`, { data: { requestId: randomUUID() }, headers: { Origin: baseURL } })).status()).toBe(404);
  } finally { await other.close(); }
  expect((await page.request.post("/api/problems", { data: { ...submission, requestId: randomUUID() }, headers: { Origin: "https://foreign.example" } })).status()).toBe(403);

  // Seed one failed worker checkpoint without spending an AI call, then retry through the real UI.
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  expect((await db.auth.signInWithPassword({ email: account.email, password })).error).toBeNull();
  const seededId = randomUUID(); const secret = "a".repeat(64);
  const seeded = await db.rpc("reserve_web_run", { p_request_id: seededId, p_secret: secret, p_description: description });
  expect(seeded.error).toBeNull();
  expect((await db.rpc("claim_web_run", { p_run_id: seededId, p_secret: secret })).error).toBeNull();
  expect((await db.rpc("finish_web_run", { p_run_id: seededId, p_secret: secret, p_status: "failed", p_error: "PROVIDER" })).data).toBe(true);
  const retryProblem = seeded.data.problemId;
  await page.goto(`/problems/${retryProblem}`);
  await expect(page.getByRole("heading", { name: "This analysis did not finish" })).toBeVisible();
  await page.getByRole("button", { name: "Retry analysis", exact: true }).click();
  await expect.poll(async () => {
    const detail = await (await page.request.get(`/api/problems/${retryProblem}`)).json();
    return { status: detail.job?.status, error: detail.job?.error };
  }, { timeout: 270_000, intervals: [2000, 5000] }).toEqual({ status: "completed", error: null });
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  expect((await db.from("web_runs").select("id").eq("problem_id", id)).data).toHaveLength(1);
  expect((await db.from("web_runs").select("id").eq("problem_id", retryProblem)).data).toHaveLength(2);
  await db.auth.signOut({ scope: "local" });
});
