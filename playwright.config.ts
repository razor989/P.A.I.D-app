import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4179";
const desktop = /(?:e2e|a11y)[\\/].*\.browser\.spec\.ts$/;
const mobile = /mobile[\\/].*\.browser\.spec\.ts$/;
/** Touch phones. Pixel 7 is 412×915; the others keep its touch and mobile
 * emulation and change only the viewport. */
const phone = devices["Pixel 7"];

export default defineConfig({
  testDir: "./tests",
  projects: [
    {
      name: "chromium",
      testMatch: desktop,
      use: { ...devices["Desktop Chrome"], baseURL },
    },
    {
      name: "phone",
      testMatch: mobile,
      use: { ...phone, baseURL },
    },
    {
      name: "phone-360",
      testMatch: mobile,
      use: { ...phone, viewport: { width: 360, height: 800 }, baseURL },
    },
    {
      name: "phone-384",
      testMatch: mobile,
      use: { ...phone, viewport: { width: 384, height: 854 }, baseURL },
    },
    {
      name: "phone-landscape",
      testMatch: mobile,
      use: { ...phone, viewport: { width: 640, height: 360 }, baseURL },
    },
    {
      // Opt-in visual baseline capture (PAID_BASELINE=<label>).
      name: "baseline",
      testMatch: /baseline[\\/].*\.browser\.spec\.ts$/,
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
