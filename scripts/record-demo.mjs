import { chromium } from "playwright";
import { mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const baseURL = process.env.DEMO_BASE_URL ?? "https://avenli.vercel.app";
const outputDir = resolve("artifacts");
const rawDir = resolve(outputDir, "raw-video");
const audioPath = resolve(outputDir, "demo-narration.wav");
const silentPath = resolve(outputDir, "avenli-demo-silent.webm");
const finalPath = resolve(outputDir, "avenli-demo-draft.mp4");
const landingPath = resolve(outputDir, "demo-landing-frame.png");
const timingPath = resolve(outputDir, "demo-voice-timing.json");

const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioPath], { encoding: "utf8" });
if (probe.status !== 0) throw new Error("Generate artifacts/demo-narration.wav before recording the video.");
const durationSeconds = Number.parseFloat(probe.stdout.trim());
const timing = JSON.parse(await readFile(timingPath, "utf8"));
if (timing.length !== 7 || Math.abs(timing.at(-1).end - durationSeconds) > 0.1) {
  throw new Error("Generate synchronized narration and captions before recording.");
}

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
const startedAt = performance.now();
const holdUntil = async (seconds) => {
  const remaining = seconds * 1_000 - (performance.now() - startedAt);
  if (remaining > 0) await page.waitForTimeout(remaining);
};

await page.goto(baseURL, { waitUntil: "domcontentloaded" });
await page.getByRole("link", { name: "Explore the demo" }).waitFor();
await page.screenshot({ path: landingPath });
await holdUntil(timing[0].end);
await page.getByRole("link", { name: "Explore the demo" }).click();
await page.getByRole("heading", { name: "Welcome, Demo visitor" }).waitFor();
await holdUntil(timing[1].end);

await page.getByRole("navigation", { name: "Demo workspace", exact: true }).getByRole("link", { name: "Problems", exact: true }).click();
await page.getByRole("heading", { name: "Find a way to Tokyo" }).waitFor();
await holdUntil(timing[1].end + 8);
await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Find a way to Tokyo" }) }).click();
await page.getByRole("heading", { name: "The outcome" }).waitFor();
await holdUntil(timing[2].end);

const sections = page.getByRole("navigation", { name: "Problem sections" });
await sections.getByRole("link", { name: "Research", exact: true }).click();
await page.getByRole("heading", { name: "Evidence register" }).waitFor();
await holdUntil(timing[3].start + 15);
await page.mouse.wheel(0, 540);
await holdUntil(timing[3].start + 22);
await page.mouse.wheel(0, -540);
await holdUntil(timing[3].end);

await sections.getByRole("link", { name: "Options", exact: true }).click();
await page.getByRole("table", { name: "Illustrative option comparison" }).waitFor();
await holdUntil(timing[4].end);
await page.goto(`${baseURL}/demo/problems/demo-launch?view=tasks`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "External action preview" }).waitFor();
await page.getByRole("button", { name: "Review approval" }).click();
await page.getByRole("button", { name: "Create event now" }).waitFor();
await holdUntil(timing[5].end);
await page.getByRole("navigation", { name: "Problem sections" }).getByRole("link", { name: "Decisions", exact: true }).click();
await holdUntil(timing[6].start + 12);

await page.goto(baseURL, { waitUntil: "domcontentloaded" });
await page.getByRole("link", { name: "Explore the demo" }).waitFor();
await holdUntil(durationSeconds + 1);
await context.close();
await browser.close();

const recordings = (await readdir(rawDir)).filter((name) => name.endsWith(".webm"));
if (recordings.length !== 1) throw new Error(`Expected one recording, found ${recordings.length}.`);
await rm(silentPath, { force: true });
await rename(resolve(rawDir, recordings[0]), silentPath);

const encode = spawnSync("ffmpeg", [
  "-y", "-i", silentPath, "-loop", "1", "-framerate", "25", "-i", landingPath, "-i", audioPath,
  "-filter_complex", "[0:v][1:v]overlay=0:0:enable='lt(t,4)',subtitles=docs/demo-captions.srt:force_style='FontName=Arial,FontSize=10,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=24'[video]",
  "-map", "[video]", "-map", "2:a",
  "-af", "loudnorm=I=-18:TP=-2:LRA=9",
  "-c:v", "libx264", "-preset", "medium", "-crf", "22",
  "-c:a", "aac", "-b:a", "160k", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", "-shortest", finalPath,
], { stdio: "inherit" });
if (encode.status !== 0) throw new Error("ffmpeg could not assemble the demo video.");

console.log(finalPath);
