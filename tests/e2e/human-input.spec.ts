import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { register, live, baseURL } from "./helpers";

test.skip(!live, "Requires real local Supabase, Nebius and Tavily.");
test("questions survive reload and submitted answers resume the same saved analysis exactly once", async ({ page, request, browser }) => {
  test.setTimeout(360_000);
  await register(page, request);
  await page.getByRole("link", { name: "New problem", exact: true }).first().click();
  await page.getByLabel("Your problem", { exact: true }).fill("Help me plan a two-hour beginner workshop about public Python documentation for local volunteers. The date, audience size, venue location and whether attendees have laptops are not specified yet. Ask me for those missing personal details before doing any research. The result should be a draft workshop plan only; do not contact people, spend money or take external actions.");
  await page.getByRole("button", { name: "Resolve it", exact: true }).click();
  await expect(page).toHaveURL(/\/problems\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect(page.getByRole("heading", { name: "Resolve needs your input" })).toBeVisible({ timeout: 120_000 });
  const paused = await (await page.request.get(`/api/problems/${id}`)).json();
  expect(paused.job.status).toBe("action_required");
  expect(paused.snapshot.state).toBe("ACTION_REQUIRED");
  expect(paused.snapshot.research).toBeNull();
  expect(paused.snapshot.revision).toBe(4);
  const runId = paused.job.id;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Resolve needs your input" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry analysis", exact: true })).toHaveCount(0);
  const other = await browser.newContext({ baseURL });
  try {
    expect((await other.request.post(`/api/problems/${id}/respond`, { data: { requestId: randomUUID(), runId, answers: ["forged"] }, headers: { Origin: baseURL } })).status()).toBe(401);
    await register(await other.newPage(), other.request);
    expect((await other.request.post(`/api/problems/${id}/respond`, { data: { requestId: randomUUID(), runId, answers: ["forged"] }, headers: { Origin: baseURL } })).status()).toBe(404);
  } finally { await other.close(); }
  const answer = "My confirmed workshop details: October 15, 2026, 14:00–16:00, Prague public community room already reserved free of charge. Twelve adult beginners. Everyone brings a laptop; Wi-Fi and projector are available. English materials, Python 3 installed, no spending budget. Goal: learn to find and read the official Python tutorial. Produce a draft agenda for me to review, with no external actions.";
  for (const question of paused.humanRequest.questions) await page.getByLabel(question, { exact: true }).fill(answer);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/human-input-mobile.png", fullPage: true });
  const outgoing = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/respond"));
  await page.getByRole("button", { name: "Save answers and continue" }).click();
  const submission = (await outgoing).postDataJSON();
  await expect(page.getByRole("heading", { name: "Your saved responses" })).toBeVisible();
  expect((await page.request.post(`/api/problems/${id}/respond`, { data: submission, headers: { Origin: baseURL } })).status()).toBe(202);
  expect((await page.request.post(`/api/problems/${id}/respond`, { data: { ...submission, answers: submission.answers.map(() => "Changed") }, headers: { Origin: baseURL } })).status()).toBe(409);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your saved responses" })).toBeVisible();
  await expect.poll(async () => {
    const detail = await (await page.request.get(`/api/problems/${id}`)).json();
    return { status: detail.job?.status, error: detail.job?.error };
  }, { timeout: 240_000, intervals: [2000, 5000] }).toEqual({ status: "completed", error: null });
  const complete = await (await page.request.get(`/api/problems/${id}`)).json();
  expect(complete.job.id).toBe(runId);
  expect(complete.snapshot.revision).toBe(12);
  expect(complete.snapshot.events.filter((event: { state: string }) => event.state === "INTAKE")).toHaveLength(1);
  expect(complete.snapshot.events.filter((event: { state: string }) => event.state === "RESUME")).toHaveLength(1);
  expect(complete.snapshot.intake).toEqual(paused.snapshot.intake);
  expect(complete.snapshot.human.responses.every((item: { answer: string }) => item.answer === answer)).toBe(true);
  expect(Array.isArray(complete.snapshot.research.sources)).toBe(true);
  if (!complete.snapshot.research.sources.length) {
    expect(complete.snapshot.research.output.claims).toEqual([]);
    expect(complete.snapshot.decision.confidence).toBe("low");
  }
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  await page.screenshot({ path: "test-results/human-resumed-mobile.png", fullPage: false });
});
