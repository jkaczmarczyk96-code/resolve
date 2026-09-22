import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const narrationPath = resolve("docs/demo-narration.md");
const audioPath = resolve("artifacts/demo-narration.wav");
const outputPath = resolve("docs/demo-captions.srt");

const markdown = await readFile(narrationPath, "utf8");
const body = markdown.split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#") && !line.startsWith("Target length:"))
  .join(" ");
const sentences = body.match(/[^.!?]+[.!?]+/g)?.map((sentence) => sentence.trim()) ?? [];
if (!sentences.length) throw new Error("No narration sentences found.");

const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioPath], { encoding: "utf8" });
if (probe.status !== 0) throw new Error("Generate artifacts/demo-narration.wav before captions.");
const duration = Number.parseFloat(probe.stdout.trim());
const weights = sentences.map((sentence) => sentence.split(/\s+/).length);
const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

const timestamp = (seconds) => {
  const milliseconds = Math.max(0, Math.round(seconds * 1_000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1_000);
  const millis = milliseconds % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
};

let elapsed = 0;
const cues = sentences.map((sentence, index) => {
  const start = elapsed;
  elapsed = index === sentences.length - 1 ? duration : elapsed + (duration * weights[index] / totalWeight);
  return `${index + 1}\n${timestamp(start)} --> ${timestamp(elapsed)}\n${sentence}\n`;
});
await writeFile(outputPath, cues.join("\n"), "utf8");
console.log(outputPath);
