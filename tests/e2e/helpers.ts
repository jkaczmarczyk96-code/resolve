import { randomUUID } from "node:crypto";
import { expect, type Page, type APIRequestContext } from "@playwright/test";
export const password = "ResolveTestPassword12";
export const live = process.env.RESOLVE_E2E_LIVE === "1";
export const baseURL = live ? "http://127.0.0.1:3000" : "http://127.0.0.1:3001";
export async function mail(request: APIRequestContext, email: string, type = "signup"): Promise<string> {
  if (live) {
    let link: string | undefined;
    await expect.poll(async () => {
      const response = await request.get(`http://127.0.0.1:55424/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
      const inbox: { messages?: { ID: string }[] } = await response.json();
      for (const message of inbox.messages ?? []) {
        const detail: { HTML?: string } = await (await request.get(`http://127.0.0.1:55424/api/v1/message/${message.ID}`)).json();
        const href = detail.HTML?.match(/href="([^"]+)"/i)?.[1]?.replaceAll("&amp;", "&");
        if (href && new URL(href).searchParams.get("type") === type) { link = href; return true; }
      }
      return false;
    }, { timeout: 15_000 }).toBe(true);
    if (!link) throw new Error("Local Supabase email not found");
    return link;
  }
  const response = await request.get(`http://127.0.0.1:54331/__test/mail?email=${encodeURIComponent(email)}`);
  const body: unknown = await response.json();
  if (typeof body !== "object" || !body || !("url" in body) || typeof body.url !== "string") throw new Error("Test email not found");
  return body.url;
}
export async function register(page: Page, request: APIRequestContext) {
  const email = `resolve-${randomUUID()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Display name (optional)").fill("Resolve Tester");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("confirmation link");
  const confirmation = await mail(request, email);
  await page.goto(confirmation);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Welcome, Resolve Tester" })).toBeVisible();
  return { email, confirmation };
}
export async function login(page: Page, email: string, nextPassword = password) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(nextPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
