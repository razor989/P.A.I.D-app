import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Bounded production-build verification; startup budget includes this host's latency.
export default defineConfig({
  ...base,
  timeout: 180_000,
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4188 --strictPort",
    url: "http://127.0.0.1:4188",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { baseURL: "http://127.0.0.1:4188", actionTimeout: 30_000 },
    },
  ],
});
