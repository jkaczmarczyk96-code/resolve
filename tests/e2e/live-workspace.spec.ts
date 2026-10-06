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
  await page.getByRole("button", { name: "Solve this", exact: true }).click();
  const submission = (await outgoing).postDataJSON();
  await expect(page).toHaveURL(/\/problems\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  const duplicate = await page.request.post("/api/problems", { data: submission, headers: { Origin: baseURL } });
  expect(duplicate.status()).toBe(202);
  expect((await duplicate.json()).problemId).toBe(id);
  expect(duplicate.headers()["cache-control"]).toContain("no-store");
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Analysis progress" })).toBeVisible();
  async function finishAnalysis(problemId: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await expect.poll(async () => {
        const detail = await (await page.request.get(`/api/problems/${problemId}`)).json();
        return detail.job?.status;
      }, { timeout: 270_000, intervals: [2000, 5000] }).toMatch(/^(completed|action_required|failed)$/);
      const detail = await (await page.request.get(`/api/problems/${problemId}`)).json();
      expect(detail.job?.status, `Analysis failed: ${detail.job?.error ?? "unknown error"}`).not.toBe("failed");
      expect(detail.job?.error).toBeNull();
      if (detail.job?.status === "completed") return;
      expect(detail.humanRequest?.questions.length).toBeGreaterThan(0);
      await page.goto(`/problems/${problemId}`);
      for (const question of detail.humanRequest.questions as string[]) {
        await page.getByLabel(question, { exact: true }).fill("I do not know. Please research official public documentation and state any unresolved uncertainty. No other personal constraints apply.");
      }
      await page.getByRole("button", { name: "Save answers and continue" }).click();
      await expect(page.getByRole("heading", { name: "Your saved responses" })).toBeVisible();
    }
    const detail = await (await page.request.get(`/api/problems/${problemId}`)).json();
    expect(detail.job?.status).toBe("completed");
  }
  await finishAnalysis(id);
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Result", exact: true })).toBeVisible();
  const result = await (await page.request.get(`/api/problems/${id}`)).json();
  expect(result.snapshot.events.length).toBeGreaterThanOrEqual(10);
  expect(result.snapshot.qualityPolicy).toBe(2);
  expect(result.snapshot.research.sources.length).toBeGreaterThan(0);
  const sections = page.getByRole("navigation", { name: "Problem sections" });
  await sections.getByRole("link", { name: "Research", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Research summary" })).toBeVisible();
  await page.getByText(/^Retrieved sources \(/).click();
  await expect(page.getByRole("link", { name: result.snapshot.research.sources[0].title }).last()).toBeVisible();
  await page.getByText("Evidence quality and detailed checks").click();
  await expect(page.getByRole("heading", { name: "Evidence quality", exact: true })).toBeVisible();
  for (const [tab, heading] of [["Options", "Options to consider"], ["Risks", "Critic review"], ["Tasks", "Action plan"], ["Decisions", "Decision trail"]]) {
    if (tab === "Tasks") await sections.getByRole("link", { name: tab, exact: true }).click();
    else await sections.getByRole("combobox", { name: "More sections" }).selectOption(tab.toLowerCase());
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await sections.getByRole("link", { name: "Tasks", exact: true }).click();
  const firstTaskStatus = page.locator('select[aria-label^="Status for"]').first();
  await expect(firstTaskStatus).toBeEnabled();
  await firstTaskStatus.selectOption("completed");
  await expect(firstTaskStatus).toHaveValue("completed");
  await page.reload();
  await expect(page.locator('select[aria-label^="Status for"]').first()).toHaveValue("completed");
  await page.getByRole("button", { name: "Mark solved", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reopen problem", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reopen problem", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark solved", exact: true })).toBeVisible();
  await sections.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByText("Problem history", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/live-workspace-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await sections.getByRole("link", { name: "Research", exact: true }).click();
  await expect(page.getByText(/^Retrieved sources \(/)).toBeVisible();
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
  await finishAnalysis(retryProblem);
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  expect((await db.from("web_runs").select("id").eq("problem_id", id)).data).toHaveLength(1);
  expect((await db.from("web_runs").select("id").eq("problem_id", retryProblem)).data).toHaveLength(2);
  await db.auth.signOut({ scope: "local" });
});
