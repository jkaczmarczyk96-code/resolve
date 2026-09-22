import { chromium } from "playwright";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const baseURL = process.env.DEMO_BASE_URL ?? "https://avenli.vercel.app";
const outputDir = resolve("artifacts");
const rawDir = resolve(outputDir, "raw-video");
const audioPath = resolve(outputDir, "demo-narration.wav");
const silentPath = resolve(outputDir, "avenli-demo-silent.webm");
const finalPath = resolve(outputDir, "avenli-demo-draft.mp4");

const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioPath], { encoding: "utf8" });
if (probe.status !== 0) throw new Error("Generate artifacts/demo-narration.wav before recording the video.");
const durationSeconds = Number.parseFloat(probe.stdout.trim());
const scale = durationSeconds / 175;
const pause = (seconds) => new Promise((done) => setTimeout(done, seconds * scale * 1_000));

await rm(rawDir, { recursive: true, force: true });
await mkdir(rawDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: rawDir, size: { width: 1600, height: 900 } },
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(60_000);
const settle = () => page.waitForTimeout(1_200);

await page.goto(baseURL, { waitUntil: "domcontentloaded" });
await page.getByRole("link", { name: "Explore the demo" }).waitFor();
await pause(18);
await page.getByRole("link", { name: "Explore the demo" }).click();
await page.getByRole("heading", { name: "Welcome, Demo visitor" }).waitFor();
await settle();
await pause(16);

await page.getByRole("navigation", { name: "Demo workspace", exact: true }).getByRole("link", { name: "Problems", exact: true }).click();
await page.getByRole("heading", { name: "Find a way to Tokyo" }).waitFor();
await settle();
await pause(10);
await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Find a way to Tokyo" }) }).click();
await page.getByRole("heading", { name: "The outcome" }).waitFor();
await settle();
await pause(25);

const sections = page.getByRole("navigation", { name: "Problem sections" });
await sections.getByRole("link", { name: "Research", exact: true }).click();
await page.getByRole("heading", { name: "Evidence register" }).waitFor();
await settle();
await pause(18);
await page.mouse.wheel(0, 540);
await pause(15);
await page.mouse.wheel(0, -540);

await sections.getByRole("link", { name: "Options", exact: true }).click();
await page.getByRole("table", { name: "Illustrative option comparison" }).waitFor();
await settle();
await pause(25);
await sections.getByRole("link", { name: "Tasks", exact: true }).click();
await settle();
await pause(22);
await sections.getByRole("link", { name: "Decisions", exact: true }).click();
await settle();
await pause(16);

await page.goto(baseURL, { waitUntil: "domcontentloaded" });
await page.getByRole("link", { name: "Explore the demo" }).waitFor();
await pause(10);
await context.close();
await browser.close();

const recordings = (await readdir(rawDir)).filter((name) => name.endsWith(".webm"));
if (recordings.length !== 1) throw new Error(`Expected one recording, found ${recordings.length}.`);
await rm(silentPath, { force: true });
await rename(resolve(rawDir, recordings[0]), silentPath);

const encode = spawnSync("ffmpeg", [
  "-y", "-i", silentPath, "-i", audioPath,
  "-c:v", "libx264", "-preset", "medium", "-crf", "22",
  "-c:a", "aac", "-b:a", "160k", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", "-shortest", finalPath,
], { stdio: "inherit" });
if (encode.status !== 0) throw new Error("ffmpeg could not assemble the demo video.");

console.log(finalPath);
