import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { combineChunks, createChunks } from "@supabase/ssr";
import type { Database } from "../../src/lib/database/types";

import { password, live, baseURL, mail, register, login } from "./helpers";

test("register → confirm → persistent session → logout → login", async ({ page, request }) => {
  const { email } = await register(page, request);
  await page.reload();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?message=signed-out$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await login(page, email);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("recovery works in a fresh browser; replay cannot change the password", async ({ page, request, browser }) => {
  const { email } = await register(page, request);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("/forgot-password");
  if (live) await page.waitForTimeout(1100); // Local Auth enforces a 1-second email cooldown.
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.getByRole("status")).toContainText("If this address");
  const link = await mail(request, email, "recovery");
  const context = await browser.newContext();
  const recovery = await context.newPage();
  await recovery.goto(link);
  await expect(recovery).toHaveURL(`${baseURL}/reset-password`);
  const cookie = (await context.cookies()).find((cookie) => cookie.name === "resolve-recovery");
  expect(cookie?.httpOnly).toBe(true);
  await recovery.getByLabel("New password", { exact: true }).fill("UpdatedResolvePassword34");
  await recovery.getByLabel("Confirm password", { exact: true }).fill("UpdatedResolvePassword34");
  await recovery.getByRole("button", { name: "Save new password" }).click();
  await expect(recovery).toHaveURL(/\/login\?message=password-updated$/);
  await login(recovery, email, password);
  await expect(recovery.getByRole("main").getByRole("alert")).toContainText("Unable to sign in");
  await login(recovery, email, "UpdatedResolvePassword34");
  await expect(recovery).toHaveURL(/\/dashboard$/);
  await recovery.goto(link);
  await recovery.getByLabel("New password", { exact: true }).fill("AnotherResolvePassword56");
  await recovery.getByLabel("Confirm password", { exact: true }).fill("AnotherResolvePassword56");
  await recovery.getByRole("button", { name: "Save new password" }).click();
  await expect(recovery.getByRole("main").getByRole("alert")).toContainText("already used");
  await context.close();
});

test("all private paths redirect before rendering, preserving a safe return URL", async ({ page }) => {
  for (const path of ["/dashboard", "/problems", "/problems/new", "/problems/123?tab=plan", "/notifications", "/settings"]) {
    const response = await page.goto(path);
    await expect(page).toHaveURL(`${baseURL}/login?next=${encodeURIComponent(path)}`);
    expect(response?.headers()["cache-control"]).toContain("no-store");
  }
});

test("missing recovery proof and invalid confirmation links fail safely", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: "You need a recovery link" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save new password" })).toHaveCount(0);
  await page.goto("/auth/callback?type=signup&token_hash=" + "a".repeat(64));
  await expect(page).toHaveURL(/\/login\?error=invalid-link$/);
  await page.goto("/login?message=__proto__");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("password visibility and server validation work on a small screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/register");
  const input = page.getByLabel("Password", { exact: true });
  await input.fill("Password12345");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(input).toHaveAttribute("type", "text");
  await page.getByLabel("Email", { exact: true }).fill("person@example.com");
  await page.getByLabel("Confirm password", { exact: true }).fill("Different12345");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText("Passwords do not match.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("unsafe post-login destinations stay on Resolve", async ({ page, request }) => {
  const { email } = await register(page, request);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("/login?next=https://attacker.invalid");
  await login(page, email);
  await expect(page).toHaveURL(`${baseURL}/dashboard`);
});

test("proxy refreshes an expiring cookie session and forwards the new cookie", async ({ page, request, context }) => {
  await register(page, request);
  const cookies = await context.cookies();
  const cookie = cookies.find((cookie) => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name));
  expect(cookie).toBeDefined();
  if (!cookie) throw new Error("Expected auth cookie");
  const cookieName = cookie.name.replace(/\.\d+$/, "");
  const combined = await combineChunks(cookieName, (name) => cookies.find((item) => item.name === name)?.value);
  if (!combined) throw new Error("Expected complete auth cookie");
  const payload: Record<string, unknown> = JSON.parse(Buffer.from(combined.slice("base64-".length), "base64url").toString());
  payload.expires_at = Math.floor(Date.now() / 1000) - 10;
  const expiredValue = `base64-${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  await context.clearCookies({ name: new RegExp(`^${cookieName}(?:\\.\\d+)?$`) });
  await context.addCookies(createChunks(cookieName, expiredValue).map(({ name, value }) => ({ ...cookie, name, value })));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome, Resolve Tester" })).toBeVisible();
  const updatedCookies = await context.cookies();
  const updated = await combineChunks(cookieName, (name) => updatedCookies.find((item) => item.name === name)?.value);
  expect(updated).not.toBe(expiredValue);
  if (!updated) throw new Error("Refreshed auth cookie missing");
  const refreshed: { expires_at: number } = JSON.parse(Buffer.from(updated.slice("base64-".length), "base64url").toString());
  expect(refreshed.expires_at).toBeGreaterThan(Date.now() / 1000);
});

test("server actions reject a foreign Origin", async ({ page, request }) => {
  const { email } = await register(page, request);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  const actionRequest = page.waitForRequest((req) => req.method() === "POST" && Boolean(req.headers()["next-action"]));
  await login(page, email);
  const action = (await actionRequest).headers()["next-action"];
  const response = await request.post("/login", { headers: { "Next-Action": action, Origin: "https://attacker.invalid", "Content-Type": "text/plain" }, data: "[]" });
  expect(response.status()).toBe(500);
  expect(response.headers()["set-cookie"]).toBeUndefined();
});

test("live PostgREST enforces two-user ownership for all CRUD operations", async ({ page, request }) => {
  test.skip(!live, "Requires real Supabase RLS, never the HTTP test double.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Local Supabase config missing");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const a = createClient<Database>(url, key, options);
  const b = createClient<Database>(url, key, options);
  const anonymous = createClient<Database>(url, key, options);
  const first = await register(page, request);
  const firstAuth = await a.auth.signInWithPassword({ email: first.email, password });
  expect(firstAuth.error).toBeNull();
  if (!firstAuth.data.user) throw new Error("Test user missing");
  const second = await register(page, request);
  const secondAuth = await b.auth.signInWithPassword({ email: second.email, password });
  expect(secondAuth.error).toBeNull();
  if (!secondAuth.data.user) throw new Error("Test user missing");
  const problem = await a.from("problems").insert({ user_id: firstAuth.data.user.id, title: "RLS integration test", original_input: "Test-only record" }).select("id").single();
  expect(problem.error).toBeNull();
  if (!problem.data) throw new Error("Test problem missing");
  const id = problem.data.id;
  try {
    expect((await b.from("problems").select("id").eq("id", id)).data).toEqual([]);
    expect((await b.from("problems").insert({ user_id: firstAuth.data.user.id, title: "Forbidden", original_input: "Forbidden" })).error).not.toBeNull();
    expect((await b.from("problems").update({ title: "Forbidden" }).eq("id", id).select("id")).data).toEqual([]);
    expect((await b.from("problems").delete().eq("id", id).select("id")).data).toEqual([]);
    expect((await a.from("problems").update({ user_id: secondAuth.data.user.id }).eq("id", id)).error).not.toBeNull();
    expect((await a.from("tasks").insert({ problem_id: id, title: "Owned task" })).error).toBeNull();
    expect((await b.from("tasks").select("id").eq("problem_id", id)).data).toEqual([]);
    expect((await b.from("tasks").insert({ problem_id: id, title: "Forbidden" })).error).not.toBeNull();
    expect((await anonymous.from("problems").select("id")).error).not.toBeNull();
  } finally {
    await a.from("problems").delete().eq("id", id);
    await a.auth.signOut({ scope: "local" });
    await b.auth.signOut({ scope: "local" });
  }
});
