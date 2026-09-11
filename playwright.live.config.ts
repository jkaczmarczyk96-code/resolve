import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://127.0.0.1:3000" },
  webServer: {
    command: "npm run build && npm start -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    timeout: 120_000,
    reuseExistingServer: process.env.RESOLVE_E2E_REUSE_SERVER === "1",
  },
});
