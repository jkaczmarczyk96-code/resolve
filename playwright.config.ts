import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:3001", browserName: "chromium", trace: "off" },
  webServer: [
    { command: "node tests/e2e/provider.mjs", url: "http://127.0.0.1:54331/health", reuseExistingServer: false },
    {
      command: "npm run build && npm start -- --hostname 127.0.0.1 --port 3001",
      url: "http://127.0.0.1:3001",
      timeout: 120_000,
      reuseExistingServer: false,
      env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54331", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_test_only", SITE_URL: "http://127.0.0.1:3001" },
    },
  ],
});
