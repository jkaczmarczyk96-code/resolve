import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/live/workflow.test.ts"], environment: "node", testTimeout: 300_000, hookTimeout: 30_000, fileParallelism: false },
});
