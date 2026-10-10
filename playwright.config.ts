import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4179";

export default defineConfig({
  testDir: "./tests",
  testMatch: /(?:e2e|a11y)[\\/].*\.browser\.spec\.ts$/,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], baseURL },
    },
  ],
  retries: 0,
  reporter: "list",
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4179 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
