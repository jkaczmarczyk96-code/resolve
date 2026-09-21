import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/live/quality-evaluation.test.ts"],
    environment: "node",
    testTimeout: 900_000,
    fileParallelism: false,
  },
});
