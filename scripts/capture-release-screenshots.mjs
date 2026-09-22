import { chromium } from "playwright";
import { resolve } from "node:path";

const baseURL = process.env.DEMO_BASE_URL ?? "https://avenli.vercel.app";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();

await page.goto(`${baseURL}/demo/problems/demo-flight?view=research`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Evidence quality" }).waitFor();
await page.screenshot({ path: resolve("docs/screenshots/research-evidence.png") });

await page.goto(`${baseURL}/demo/problems/demo-launch?view=tasks`, { waitUntil: "domcontentloaded" });
const action = page.getByRole("heading", { name: "External action preview" });
await action.waitFor();
await action.evaluate((element) => element.scrollIntoView({ block: "start" }));
await page.getByRole("button", { name: "Review approval" }).click();
await page.getByRole("button", { name: "Create event now" }).waitFor();
await page.screenshot({ path: resolve("docs/screenshots/calendar-approval.png") });

await browser.close();
